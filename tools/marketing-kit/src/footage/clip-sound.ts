import { mkdirSync } from "node:fs";
import { dirname, extname, join } from "node:path";

import type { FootageClip } from "./film.js";
import { isSilent, readLoudnessMeasurement, type LoudnessMeasurement } from "./loudness.js";
import { FOOTAGE_SAMPLE_RATE } from "./normalize.js";
import { runFfmpeg, runProcess } from "./process.js";
import type { FootageProbe } from "./probe.js";

/**
 * Each clip's sound for the speech chain (issue #1139): read from the clip's source with the normalize step's own seek
 * and length (so the EDL's times hold), brought to 48 kHz stereo, raised by one linear pre-gain to about
 * `SPEECH_PRE_GAIN.target` with its true peak kept under `SPEECH_PRE_GAIN.peakCeiling`, and written as 24-bit PCM WAV.
 * Quiet phone speech is then never encoded lossily at its quiet level: the voice isolator, the speech to text, the cut,
 * the declick and the loudness pass all work on lossless sound, and the film's final AAC is the only lossy encode.
 */

/** Where the pre-gain brings a talking clip's sound: integrated loudness in LUFS, and the true peak's ceiling in dBTP. */
export const SPEECH_PRE_GAIN = { target: -23, peakCeiling: -3 } as const;

/** The loudness range `loudnorm` measures with; the pre-gain itself is a plain linear `volume`. */
const MEASURE_RANGE = 11;

/** The clip as the normalize step reads it: its trim, its source file and what the probe found. */
export interface ClipSoundInput {
  clip: Pick<FootageClip, "id" | "role" | "trim">;
  /** The source as read (a URL's downloaded copy). */
  source: string;
  probe: Pick<FootageProbe, "hasAudio">;
  /** Seconds after the trim. */
  duration: number;
}

/** A clip's lossless, pre-gained sound and the gain it got in dB. */
export interface ClipSound {
  file: string;
  gainDb: number;
}

const toFormat = `aformat=sample_rates=${String(FOOTAGE_SAMPLE_RATE)}:channel_layouts=stereo`;

/** The seek and the length of the trimmed clip, as `buildNormalizeArgs` reads its source. */
function getTrimArgs(input: ClipSoundInput): { seek: string[]; length: string[] } {
  return { seek: input.clip.trim.start > 0 ? ["-ss", String(input.clip.trim.start)] : [], length: ["-t", input.duration.toFixed(3)] };
}

/** The measuring pass over the trimmed clip's sound, after the same format change the extraction makes; writes nothing. */
export function buildClipSoundMeasureArgs(input: ClipSoundInput): string[] {
  const { seek, length } = getTrimArgs(input);
  const measure = `loudnorm=I=${String(SPEECH_PRE_GAIN.target)}:TP=${String(SPEECH_PRE_GAIN.peakCeiling)}:LRA=${String(MEASURE_RANGE)}:print_format=json`;
  return ["-hide_banner", "-nostats", ...seek, "-i", input.source, ...length, "-map", "0:a:0", "-vn", "-af", `${toFormat},${measure}`, "-f", "null", "-"];
}

/**
 * The pre-gain in dB for a measured clip: up (or down) to `SPEECH_PRE_GAIN.target`, but never past the gain that puts
 * its true peak at `SPEECH_PRE_GAIN.peakCeiling`; 0 for silence. Rounded to a hundredth of a dB.
 */
export function getPreGainDb(measurement: LoudnessMeasurement | null): number {
  if (measurement === null || isSilent(measurement)) return 0;
  const toTarget = SPEECH_PRE_GAIN.target - measurement.inputI;
  const toCeiling = Number.isFinite(measurement.inputTp) ? SPEECH_PRE_GAIN.peakCeiling - measurement.inputTp : toTarget;
  return Math.round(Math.min(toTarget, toCeiling) * 100) / 100 || 0;
}

/** The trimmed clip's sound, gained by `gainDb`, as a 24-bit 48 kHz stereo WAV; silence as long as the clip when it has none. */
export function buildClipSoundArgs(input: ClipSoundInput & { gainDb: number; output: string }): string[] {
  const codec = ["-ar", String(FOOTAGE_SAMPLE_RATE), "-ac", "2", "-c:a", "pcm_s24le", input.output];
  const { seek, length } = getTrimArgs(input);
  if (!input.probe.hasAudio) return ["-v", "error", "-y", "-f", "lavfi", "-i", `anullsrc=r=${String(FOOTAGE_SAMPLE_RATE)}:cl=stereo`, ...length, ...codec];
  return ["-v", "error", "-y", ...seek, "-i", input.source, ...length, "-map", "0:a:0", "-vn", "-af", `${toFormat},volume=${String(input.gainDb)}dB`, ...codec];
}

/** Where a clip's sound goes in the build folder. */
export function getClipSoundPath(buildDir: string, clipId: string): string {
  return join(buildDir, "audio", `${clipId}.wav`);
}

/** Measures one clip's sound; null when the clip has none. Throws naming the clip when ffmpeg fails. */
async function measureClipSound(input: ClipSoundInput, signal: AbortSignal | undefined): Promise<LoudnessMeasurement | null> {
  if (!input.probe.hasAudio) return null;
  const step = `Measuring the sound of clip ${input.clip.id}`;
  const measured = await runProcess({ command: "ffmpeg", args: buildClipSoundMeasureArgs(input), ...(signal === undefined ? {} : { signal }) });
  if (measured.kind === "not-started") throw new Error(`${step}: ffmpeg did not start (${measured.error}).`);
  if (measured.code !== 0) throw new Error(`${step}: ffmpeg ended with code ${String(measured.code)}: ${measured.stderr.trim().split("\n").slice(-3).join(" | ")}.`);
  const measurement = readLoudnessMeasurement(measured.stderr);
  if (measurement === null) throw new Error(`${step}: ffmpeg printed no loudnorm measurement for ${input.source}.`);
  return measurement;
}

/**
 * Every clip's lossless, pre-gained sound under `<buildDir>/audio/<id>.wav`, by clip id. A talking clip is gained by its
 * own measurement (`getPreGainDb`); any other clip by the mean of the talking clips' gains (0 dB without one), so a
 * b-roll's own sound under the speech keeps its relation to it. Throws naming the clip when ffmpeg fails.
 */
export async function prepareClipSounds(clips: readonly ClipSoundInput[], options: { buildDir: string; signal?: AbortSignal }): Promise<Record<string, ClipSound>> {
  const { signal } = options;
  const gains = new Map<string, number>();
  for (const clip of clips) {
    if (clip.clip.role !== "talk") continue;
    gains.set(clip.clip.id, getPreGainDb(await measureClipSound(clip, signal)));
  }
  const talking = [...gains.values()];
  const sharedGain = talking.length === 0 ? 0 : Math.round((talking.reduce((sum, gain) => sum + gain, 0) / talking.length) * 100) / 100 || 0;
  const sounds: Record<string, ClipSound> = {};
  for (const clip of clips) {
    const gainDb = gains.get(clip.clip.id) ?? sharedGain;
    const output = getClipSoundPath(options.buildDir, clip.clip.id);
    mkdirSync(dirname(output), { recursive: true });
    await runFfmpeg(`Extracting the sound of clip ${clip.clip.id}`, buildClipSoundArgs({ ...clip, gainDb, output }), { ...(signal === undefined ? {} : { signal }), output });
    sounds[clip.clip.id] = { file: output, gainDb };
  }
  return sounds;
}

/**
 * The audio codec for an intermediate file by its extension: `.wav` 32-bit float PCM (no stage clips between stages),
 * `.flac` FLAC, anything else MP3 (an app's own `.mp3` names keep working).
 */
export function getAudioCodecArgs(output: string): string[] {
  const extension = extname(output).toLowerCase();
  if (extension === ".wav") return ["-c:a", "pcm_f32le"];
  if (extension === ".flac") return ["-c:a", "flac"];
  return ["-c:a", "libmp3lame", "-q:a", "2"];
}

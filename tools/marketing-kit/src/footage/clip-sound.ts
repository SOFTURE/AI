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
 * `SPEECH_PRE_GAIN.target` with its true peak kept under `SPEECH_PRE_GAIN.peakCeiling`, and written as 24-bit PCM WAV
 * (or, with `speechPeaks: "float"`, raised to the target and written as 32-bit float, issue #1181).
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

/**
 * How the pre-gain treats a talking clip's true peak (issue #1181): `ceiling` (the default) stops the gain where the
 * peak reaches `SPEECH_PRE_GAIN.peakCeiling` and writes 24-bit PCM; `float` raises it to the target whatever its peaks
 * and writes 32-bit float PCM, so a peak above the ceiling (or 0 dBFS) cannot clip. Both are one linear gain.
 */
export type SpeechPeaks = "ceiling" | "float";

/** A measured talking clip's pre-gain: the measurement before it and what it reached. */
export interface MeasuredPreGain {
  /** Integrated loudness and true peak of the clip's sound before the pre-gain. */
  inputLufs: number;
  inputTruePeakDbtp: number;
  /** Integrated loudness and true peak after it (the input plus the gain). */
  reachedLufs: number;
  truePeakDbtp: number;
}

/**
 * What the pre-gain did to a clip (issue #1181): `on_target` reached `SPEECH_PRE_GAIN.target`; `held_by_peak_ceiling`
 * stopped at the peak ceiling, under the target; `peaks_over_ceiling` reached the target with `speechPeaks: "float"`,
 * its true peak above the ceiling (kept by the float file); `silent` a clip without sound, or silence (0 dB);
 * `shared` a clip that does not talk, gained by the talking clips' mean and not measured.
 */
export type SpeechPreGain =
  | ({ kind: "on_target" } & MeasuredPreGain)
  | ({ kind: "held_by_peak_ceiling" } & MeasuredPreGain)
  | ({ kind: "peaks_over_ceiling" } & MeasuredPreGain)
  | { kind: "silent" }
  | { kind: "shared" };

/** A clip's lossless, pre-gained sound, the gain it got in dB and what the gain reached. */
export interface ClipSound {
  file: string;
  gainDb: number;
  preGain: SpeechPreGain;
  /** Whether the clip's sound lived in one channel only and was folded onto both (issue #1385). */
  channels: ChannelBalance;
}

/**
 * How a clip's sound sits in its channels (issue #1385): `balanced` (stereo with sound in both, mono, silence, or no
 * sound at all), or `one_sided`, a stereo clip whose `live` channel carries the sound and whose other channel is dead,
 * as a wireless lavalier receiver in stereo mode records one transmitter. Levels are RMS in dBFS.
 */
export type ChannelBalance = { kind: "balanced" } | { kind: "one_sided"; live: "left" | "right"; liveRmsDb: number; deadRmsDb: number };

/**
 * When a stereo clip counts as one-sided: its quieter channel is under `deadCeilingDb` RMS and at least `minGapDb`
 * under the louder one. A dead channel measures about -115 dBFS; a phone's real stereo stays within a few dB.
 */
export const ONE_SIDED_CHANNEL = { deadCeilingDb: -70, minGapDb: 30 } as const;

const BALANCED: ChannelBalance = { kind: "balanced" };

const toFormat = `aformat=sample_rates=${String(FOOTAGE_SAMPLE_RATE)}:channel_layouts=stereo`;

/** The per-channel RMS pass over the trimmed clip's sound, as the source has it (no format change); writes nothing. */
export function buildChannelMeasureArgs(input: ClipSoundInput): string[] {
  const { seek, length } = getTrimArgs(input);
  return ["-hide_banner", "-nostats", ...seek, "-i", input.source, ...length, "-map", "0:a:0", "-vn", "-af", "astats=measure_overall=none:measure_perchannel=RMS_level", "-f", "null", "-"];
}

/** Each channel's RMS level in dBFS, in channel order, from `astats`' log; `-inf` (digital silence) is `-Infinity`. */
export function readChannelRmsDb(stderr: string): number[] {
  return [...stderr.matchAll(/RMS level dB: (-?inf|-?\d+(?:\.\d+)?)/g)].map((match) => (match[1]?.endsWith("inf") === true ? -Infinity : Number(match[1])));
}

/** The balance of a clip's channels from their RMS levels (`readChannelRmsDb`); only two channels can be one-sided. */
export function getChannelBalance(rmsDb: readonly number[]): ChannelBalance {
  const [left, right] = rmsDb;
  if (rmsDb.length !== 2 || left === undefined || right === undefined) return BALANCED;
  const [live, liveRmsDb, deadRmsDb] = left >= right ? (["left", left, right] as const) : (["right", right, left] as const);
  if (!Number.isFinite(liveRmsDb) || deadRmsDb >= ONE_SIDED_CHANNEL.deadCeilingDb || liveRmsDb - deadRmsDb < ONE_SIDED_CHANNEL.minGapDb) return BALANCED;
  return { kind: "one_sided", live, liveRmsDb, deadRmsDb };
}

/** The filter (with its trailing comma) that copies a one-sided clip's live channel onto both; empty when balanced. */
export function getChannelFoldFilter(balance: ChannelBalance): string {
  if (balance.kind === "balanced") return "";
  const channel = balance.live === "left" ? "c0" : "c1";
  return `pan=stereo|c0=${channel}|c1=${channel},`;
}

/** The log line for a clip whose sound was folded onto both channels; null for a balanced one. */
export function describeChannelFold(clipId: string, balance: ChannelBalance): string | null {
  if (balance.kind === "balanced") return null;
  const dead = balance.live === "left" ? "right" : "left";
  const level = (db: number): string => (Number.isFinite(db) ? `${String(Math.round(db * 10) / 10)} dBFS` : "silent");
  return `clip sound: clip ${clipId} has sound only in its ${balance.live} channel (${level(balance.liveRmsDb)} RMS, ${dead} ${level(balance.deadRmsDb)}); the ${balance.live} channel is played on both.`;
}

/** The seek and the length of the trimmed clip, as `buildNormalizeArgs` reads its source. */
function getTrimArgs(input: ClipSoundInput): { seek: string[]; length: string[] } {
  return { seek: input.clip.trim.start > 0 ? ["-ss", String(input.clip.trim.start)] : [], length: ["-t", input.duration.toFixed(3)] };
}

/** The measuring pass over the trimmed clip's sound, after the same format change the extraction makes; writes nothing. */
export function buildClipSoundMeasureArgs(input: ClipSoundInput & { balance?: ChannelBalance }): string[] {
  const { seek, length } = getTrimArgs(input);
  const fold = getChannelFoldFilter(input.balance ?? BALANCED);
  const measure = `loudnorm=I=${String(SPEECH_PRE_GAIN.target)}:TP=${String(SPEECH_PRE_GAIN.peakCeiling)}:LRA=${String(MEASURE_RANGE)}:print_format=json`;
  return ["-hide_banner", "-nostats", ...seek, "-i", input.source, ...length, "-map", "0:a:0", "-vn", "-af", `${fold}${toFormat},${measure}`, "-f", "null", "-"];
}

/**
 * The pre-gain in dB for a measured clip: up (or down) to `SPEECH_PRE_GAIN.target`, but never past the gain that puts
 * its true peak at `SPEECH_PRE_GAIN.peakCeiling`; 0 for silence. Rounded to a hundredth of a dB.
 */
export function getPreGainDb(measurement: LoudnessMeasurement | null): number {
  return getSpeechPreGain(measurement).gainDb;
}

/** Rounds to a hundredth, without a negative zero. */
function roundDb(value: number): number {
  return Math.round(value * 100) / 100 || 0;
}

/**
 * A measured clip's pre-gain in dB and what it reaches (issue #1181). With `peaks: "ceiling"` (the default) the gain
 * is `getPreGainDb`'s, and a clip whose true peak stops it under the target is `held_by_peak_ceiling`; with `"float"`
 * the gain always goes to the target, and a clip whose true peak then passes the ceiling is `peaks_over_ceiling`.
 */
export function getSpeechPreGain(measurement: LoudnessMeasurement | null, options: { peaks?: SpeechPeaks } = {}): { gainDb: number; preGain: SpeechPreGain } {
  if (measurement === null || isSilent(measurement)) return { gainDb: 0, preGain: { kind: "silent" } };
  const toTarget = SPEECH_PRE_GAIN.target - measurement.inputI;
  const toCeiling = Number.isFinite(measurement.inputTp) ? SPEECH_PRE_GAIN.peakCeiling - measurement.inputTp : toTarget;
  const isHeld = toCeiling < toTarget;
  const gainDb = roundDb(options.peaks === "float" ? toTarget : Math.min(toTarget, toCeiling));
  const measured: MeasuredPreGain = {
    inputLufs: roundDb(measurement.inputI),
    inputTruePeakDbtp: roundDb(measurement.inputTp),
    reachedLufs: roundDb(measurement.inputI + gainDb),
    truePeakDbtp: roundDb(measurement.inputTp + gainDb),
  };
  if (!isHeld) return { gainDb, preGain: { kind: "on_target", ...measured } };
  return { gainDb, preGain: { kind: options.peaks === "float" ? "peaks_over_ceiling" : "held_by_peak_ceiling", ...measured } };
}

/** The log line for a clip whose pre-gain did not simply reach the target; null when it did, or for silence. */
export function describeSpeechPreGain(clipId: string, sound: Pick<ClipSound, "gainDb" | "preGain">): string | null {
  const { preGain } = sound;
  if (preGain.kind !== "held_by_peak_ceiling" && preGain.kind !== "peaks_over_ceiling") return null;
  const gain = `${sound.gainDb >= 0 ? "+" : ""}${String(sound.gainDb)} dB`;
  const input = `input ${String(preGain.inputLufs)} LUFS, ${String(preGain.inputTruePeakDbtp)} dBTP`;
  if (preGain.kind === "peaks_over_ceiling") {
    return `speech pre-gain: clip ${clipId} raised by ${gain} to ${String(preGain.reachedLufs)} LUFS (${input}); its true peak ${String(preGain.truePeakDbtp)} dBTP is over the ${String(SPEECH_PRE_GAIN.peakCeiling)} dBTP ceiling, kept by the 32-bit float sound.`;
  }
  return `speech pre-gain: clip ${clipId} held by the ${String(SPEECH_PRE_GAIN.peakCeiling)} dBTP peak ceiling at ${gain}: it reaches ${String(preGain.reachedLufs)} LUFS, not ${String(SPEECH_PRE_GAIN.target)} (${input}). speechPeaks: "float" reaches the target without clipping.`;
}

/**
 * The trimmed clip's sound, gained by `gainDb`, as a 48 kHz stereo WAV (24-bit PCM, or 32-bit float with
 * `peaks: "float"`); silence as long as the clip when it has none.
 */
export function buildClipSoundArgs(input: ClipSoundInput & { gainDb: number; output: string; peaks?: SpeechPeaks; balance?: ChannelBalance }): string[] {
  const codec = ["-ar", String(FOOTAGE_SAMPLE_RATE), "-ac", "2", "-c:a", input.peaks === "float" ? "pcm_f32le" : "pcm_s24le", input.output];
  const { seek, length } = getTrimArgs(input);
  if (!input.probe.hasAudio) return ["-v", "error", "-y", "-f", "lavfi", "-i", `anullsrc=r=${String(FOOTAGE_SAMPLE_RATE)}:cl=stereo`, ...length, ...codec];
  return ["-v", "error", "-y", ...seek, "-i", input.source, ...length, "-map", "0:a:0", "-vn", "-af", `${getChannelFoldFilter(input.balance ?? BALANCED)}${toFormat},volume=${String(input.gainDb)}dB`, ...codec];
}

/** Where a clip's sound goes in the build folder. */
export function getClipSoundPath(buildDir: string, clipId: string): string {
  return join(buildDir, "audio", `${clipId}.wav`);
}

/** Measures one clip's sound; null when the clip has none. Throws naming the clip when ffmpeg fails. */
/** Runs one ffmpeg measuring pass and answers its log; throws naming `step` when ffmpeg does not start or fails. */
async function runMeasure(step: string, args: string[], signal: AbortSignal | undefined): Promise<string> {
  const measured = await runProcess({ command: "ffmpeg", args, ...(signal === undefined ? {} : { signal }) });
  if (measured.kind === "not-started") throw new Error(`${step}: ffmpeg did not start (${measured.error}).`);
  if (measured.code !== 0) throw new Error(`${step}: ffmpeg ended with code ${String(measured.code)}: ${measured.stderr.trim().split("\n").slice(-3).join(" | ")}.`);
  return measured.stderr;
}

/** How one clip's sound sits in its channels (issue #1385); `balanced` for a clip without sound. Throws naming the clip when ffmpeg fails. */
async function measureClipChannels(input: ClipSoundInput, signal: AbortSignal | undefined): Promise<ChannelBalance> {
  if (!input.probe.hasAudio) return BALANCED;
  const stderr = await runMeasure(`Measuring the channels of clip ${input.clip.id}`, buildChannelMeasureArgs(input), signal);
  return getChannelBalance(readChannelRmsDb(stderr));
}

async function measureClipSound(input: ClipSoundInput & { balance: ChannelBalance }, signal: AbortSignal | undefined): Promise<LoudnessMeasurement | null> {
  if (!input.probe.hasAudio) return null;
  const step = `Measuring the sound of clip ${input.clip.id}`;
  const measurement = readLoudnessMeasurement(await runMeasure(step, buildClipSoundMeasureArgs(input), signal));
  if (measurement === null) throw new Error(`${step}: ffmpeg printed no loudnorm measurement for ${input.source}.`);
  return measurement;
}

/**
 * Every clip's lossless, pre-gained sound under `<buildDir>/audio/<id>.wav`, by clip id. A talking clip is gained by its
 * own measurement (`getPreGainDb`); any other clip by the mean of the talking clips' gains (0 dB without one), so a
 * b-roll's own sound under the speech keeps its relation to it. Each answers its `preGain` (issue #1181), and `log` gets
 * a line for every clip the peak ceiling held under the target (or, with `peaks: "float"`, whose peaks pass it). A clip
 * whose sound lives in one channel only is folded onto both before it is measured and extracted (issue #1385), with a
 * log line. Throws naming the clip when ffmpeg fails.
 */
export async function prepareClipSounds(
  clips: readonly ClipSoundInput[],
  options: { buildDir: string; signal?: AbortSignal; peaks?: SpeechPeaks; log?: (line: string) => void },
): Promise<Record<string, ClipSound>> {
  const { signal } = options;
  const peaks = options.peaks ?? "ceiling";
  const balances = new Map<string, ChannelBalance>();
  for (const clip of clips) balances.set(clip.clip.id, await measureClipChannels(clip, signal));
  const measured = new Map<string, { gainDb: number; preGain: SpeechPreGain }>();
  for (const clip of clips) {
    if (clip.clip.role !== "talk") continue;
    const balance = balances.get(clip.clip.id) ?? BALANCED;
    measured.set(clip.clip.id, getSpeechPreGain(await measureClipSound({ ...clip, balance }, signal), { peaks }));
  }
  const talking = [...measured.values()].map((entry) => entry.gainDb);
  const sharedGain = talking.length === 0 ? 0 : Math.round((talking.reduce((sum, gain) => sum + gain, 0) / talking.length) * 100) / 100 || 0;
  const sounds: Record<string, ClipSound> = {};
  for (const clip of clips) {
    const shared: { gainDb: number; preGain: SpeechPreGain } = { gainDb: sharedGain, preGain: { kind: "shared" } };
    const { gainDb, preGain } = measured.get(clip.clip.id) ?? shared;
    const output = getClipSoundPath(options.buildDir, clip.clip.id);
    mkdirSync(dirname(output), { recursive: true });
    const channels = balances.get(clip.clip.id) ?? BALANCED;
    await runFfmpeg(`Extracting the sound of clip ${clip.clip.id}`, buildClipSoundArgs({ ...clip, gainDb, output, peaks, balance: channels }), { ...(signal === undefined ? {} : { signal }), output });
    const sound: ClipSound = { file: output, gainDb, preGain, channels };
    sounds[clip.clip.id] = sound;
    for (const line of [describeChannelFold(clip.clip.id, channels), describeSpeechPreGain(clip.clip.id, sound)]) if (line !== null) options.log?.(line);
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

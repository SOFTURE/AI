import { getSoundSpan, type Edl } from "./edl.js";
import { FOOTAGE_SAMPLE_RATE } from "./normalize.js";
import { volumeExpression, type VolumeKeyframe } from "./music.js";

/** ffmpeg steps of the footage render: pure argument builders, tested without ffmpeg (`runFfmpeg` in `process.ts` runs them). */

/** A short fade at every cut of the speech track, so a cut never clicks. */
const CUT_FADE_SECONDS = 0.02;
const MUSIC_FADE_IN = 1;
const MUSIC_FADE_OUT = 1.5;

const r3 = (value: number): number => Math.round(value * 1000) / 1000 || 0;

/**
 * The speech track: every segment's sound cut from its sound span (its own clip's, or `audio`'s: a J/L-cut or b-roll
 * over speech) and joined in order; `audio.ownVolume` keeps the picture clip's own sound under it.
 */
export function buildSpeechArgs(edl: Edl, sources: Record<string, string>, output: string): string[] {
  const inputs: string[] = [];
  const parts: string[] = [];
  const getSource = (clip: string): string => {
    const source = sources[clip];
    if (source === undefined) throw new Error(`No audio for clip "${clip}" of the EDL.`);
    return source;
  };
  const cut = (input: number, span: { start: number; end: number }, duration: number): string =>
    `[${input}:a]atrim=start=${span.start}:end=${span.end},asetpts=PTS-STARTPTS,aformat=sample_rates=${FOOTAGE_SAMPLE_RATE}:channel_layouts=stereo,apad=whole_dur=${duration}`;
  edl.segments.forEach((segment, index) => {
    const sound = getSoundSpan(segment);
    const duration = r3(segment.end - segment.start);
    const fades = `afade=t=in:d=${CUT_FADE_SECONDS},afade=t=out:st=${r3(Math.max(0, duration - CUT_FADE_SECONDS))}:d=${CUT_FADE_SECONDS}`;
    const input = inputs.length / 2;
    inputs.push("-i", getSource(sound.clip));
    const own = segment.audio?.ownVolume ?? 0;
    // A borrowed span may be a few milliseconds longer than the picture: it is cut to the picture's length.
    const fit = segment.audio === undefined ? "" : `,atrim=end=${duration}`;
    if (own <= 0) {
      parts.push(`${cut(input, sound, duration)}${fit},${fades}[a${index}]`);
      return;
    }
    const ownInput = inputs.length / 2;
    inputs.push("-i", getSource(segment.clip));
    parts.push(`${cut(input, sound, duration)},atrim=end=${duration}[s${index}]`);
    parts.push(`${cut(ownInput, segment, duration)},atrim=end=${duration},volume=${own}[o${index}]`);
    parts.push(`[s${index}][o${index}]amix=inputs=2:duration=first:normalize=0,${fades}[a${index}]`);
  });
  const joined = edl.segments.map((_, index) => `[a${index}]`).join("");
  const graph = `${parts.join(";")};${joined}concat=n=${edl.segments.length}:v=0:a=1[speech]`;
  return ["-v", "error", "-y", ...inputs, "-filter_complex", graph, "-map", "[speech]", "-c:a", "libmp3lame", "-q:a", "2", output];
}

/** The music track: looped to the film's length, ducked by the keyframes, faded in and out. */
export function buildMusicArgs(options: { input: string; seconds: number; keyframes: VolumeKeyframe[]; output: string }): string[] {
  const { seconds } = options;
  const filters = [
    `aformat=sample_rates=${FOOTAGE_SAMPLE_RATE}:channel_layouts=stereo`,
    `volume=eval=frame:volume='${volumeExpression(options.keyframes)}'`,
    `afade=t=in:d=${MUSIC_FADE_IN}`,
    `afade=t=out:st=${r3(Math.max(0, seconds - MUSIC_FADE_OUT))}:d=${MUSIC_FADE_OUT}`,
  ];
  return ["-v", "error", "-y", "-stream_loop", "-1", "-i", options.input, "-t", String(seconds), "-af", filters.join(","), "-c:a", "libmp3lame", "-q:a", "2", options.output];
}

/** A small silent copy of the cut, what Video to Music scores. */
export function buildCutPreviewArgs(edl: Edl, clips: Record<string, string>, output: string): string[] {
  const inputs: string[] = [];
  const parts: string[] = [];
  edl.segments.forEach((segment, index) => {
    const clip = clips[segment.clip];
    if (clip === undefined) throw new Error(`No file for clip "${segment.clip}" of the EDL.`);
    inputs.push("-i", clip);
    parts.push(`[${index}:v]trim=start=${segment.start}:end=${segment.end},setpts=PTS-STARTPTS,scale=540:-2,setsar=1[v${index}]`);
  });
  const joined = edl.segments.map((_, index) => `[v${index}]`).join("");
  const graph = `${parts.join(";")};${joined}concat=n=${edl.segments.length}:v=1:a=0[cut]`;
  return ["-v", "error", "-y", ...inputs, "-filter_complex", graph, "-map", "[cut]", "-c:v", "libx264", "-preset", "veryfast", "-crf", "28", output];
}

/** The cut's last frame (the end card's backdrop): a frame just before the last segment's end. */
export function buildLastFrameArgs(edl: Edl, clips: Record<string, string>, output: string): string[] {
  const last = edl.segments.at(-1);
  if (last === undefined) throw new Error("The EDL has no segments.");
  const clip = clips[last.clip];
  if (clip === undefined) throw new Error(`No file for clip "${last.clip}" of the EDL.`);
  const at = r3(Math.max(last.start, last.end - 0.07));
  return ["-v", "error", "-y", "-ss", String(at), "-i", clip, "-frames:v", "1", "-q:v", "2", output];
}

/** Audio extracted from a normalized clip, for the providers and the speech track. */
export function buildAudioArgs(clip: string, output: string): string[] {
  return ["-v", "error", "-y", "-i", clip, "-vn", "-c:a", "libmp3lame", "-q:a", "2", output];
}

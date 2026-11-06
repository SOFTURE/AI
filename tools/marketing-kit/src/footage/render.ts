import { getAudioCodecArgs } from "./clip-sound.js";
import { getSoundSpan, type Edl } from "./edl.js";
import { DEFAULT_EDIT, type FootageEdit } from "./film.js";
import { FOOTAGE_SAMPLE_RATE } from "./normalize.js";
import { volumeExpression, type VolumeKeyframe } from "./music.js";

/** ffmpeg steps of the footage render: pure argument builders, tested without ffmpeg (`runFfmpeg` in `process.ts` runs them). */

const MUSIC_FADE_IN = 1;
const MUSIC_FADE_OUT = 1.5;

const r3 = (value: number): number => Math.round(value * 1000) / 1000 || 0;
const r4 = (value: number): number => Math.round(value * 10000) / 10000 || 0;

/** How the speech track is joined at the cuts. */
export interface SpeechCutOptions {
  /** The fade at every cut, in seconds; default 0.02 (`DEFAULT_EDIT.cutAudioFadeMs`), so a cut never clicks. */
  fadeSeconds?: number;
  /**
   * Cross-fade the two sides of every cut over `fadeSeconds`, centred on the cut: each side runs on into its source
   * for half the fade (silence where the source ends). By default each side fades out and in (a short dip).
   */
  isCrossfade?: boolean;
}

/** The film's cut sound settings (`edit.cutAudioFadeMs`, `edit.isCutAudioCrossfade`) as `buildSpeechArgs` takes them. */
export function getSpeechCutOptions(edit: Pick<FootageEdit, "cutAudioFadeMs" | "isCutAudioCrossfade">): Required<SpeechCutOptions> {
  return { fadeSeconds: r4(edit.cutAudioFadeMs / 1000), isCrossfade: edit.isCutAudioCrossfade };
}

/**
 * The speech track: every segment's sound cut from its sound span (its own clip's, or `audio`'s: a J/L-cut or b-roll
 * over speech) and joined in order; `audio.ownVolume` keeps the picture clip's own sound under it. Each cut fades over
 * `fadeSeconds`: a short dip, or with `isCrossfade` a cross-fade centred on the cut. Either way the track is exactly
 * the cut's length and every word stays under its picture.
 */
export function buildSpeechArgs(edl: Edl, sources: Record<string, string>, output: string, options: SpeechCutOptions = {}): string[] {
  const fadeSeconds = options.fadeSeconds ?? r4(DEFAULT_EDIT.cutAudioFadeMs / 1000);
  if (!(fadeSeconds > 0)) throw new Error(`The speech track's cut fade must be above 0 seconds, got ${String(fadeSeconds)}.`);
  const isCrossfade = options.isCrossfade === true && edl.segments.length > 1;
  const inputs: string[] = [];
  const parts: string[] = [];
  const getSource = (clip: string): string => {
    const source = sources[clip];
    if (source === undefined) throw new Error(`No audio for clip "${clip}" of the EDL.`);
    return source;
  };
  const addInput = (clip: string): number => {
    const input = inputs.length / 2;
    inputs.push("-i", getSource(clip));
    return input;
  };
  const format = `asetpts=PTS-STARTPTS,aformat=sample_rates=${FOOTAGE_SAMPLE_RATE}:channel_layouts=stereo`;
  const cut = (input: number, span: { start: number; end: number }, duration: number): string =>
    `[${input}:a]atrim=start=${span.start}:end=${span.end},${format},apad=whole_dur=${duration}`;
  const last = edl.segments.length - 1;
  const half = r4(fadeSeconds / 2);
  edl.segments.forEach((segment, index) => {
    const sound = getSoundSpan(segment);
    const duration = r3(segment.end - segment.start);
    const own = segment.audio?.ownVolume ?? 0;
    if (isCrossfade) {
      // Half the fade on each side of the cut, read on into the source; where the source starts too late, silence.
      const head = index === 0 ? 0 : half;
      const tail = index === last ? 0 : half;
      const length = r4(duration + head + tail);
      const extend = (input: number, span: { start: number; end: number }): string => {
        const lead = Math.min(head, span.start);
        const silence = Math.round((head - lead) * 1000);
        const delay = silence > 0 ? `,adelay=${silence}:all=1` : "";
        return `[${input}:a]atrim=start=${r4(span.start - lead)}:end=${r4(span.start + duration + tail)},${format}${delay},apad=whole_dur=${length},atrim=end=${length}`;
      };
      const input = addInput(sound.clip);
      if (own <= 0) {
        parts.push(`${extend(input, sound)}[a${index}]`);
        return;
      }
      const ownInput = addInput(segment.clip);
      parts.push(`${extend(input, sound)}[s${index}]`);
      parts.push(`${extend(ownInput, segment)},volume=${own}[o${index}]`);
      parts.push(`[s${index}][o${index}]amix=inputs=2:duration=first:normalize=0[a${index}]`);
      return;
    }
    const fades = `afade=t=in:d=${fadeSeconds},afade=t=out:st=${r3(Math.max(0, duration - fadeSeconds))}:d=${fadeSeconds}`;
    const input = addInput(sound.clip);
    // A borrowed span may be a few milliseconds longer than the picture: it is cut to the picture's length.
    const fit = segment.audio === undefined ? "" : `,atrim=end=${duration}`;
    if (own <= 0) {
      parts.push(`${cut(input, sound, duration)}${fit},${fades}[a${index}]`);
      return;
    }
    const ownInput = addInput(segment.clip);
    parts.push(`${cut(input, sound, duration)},atrim=end=${duration}[s${index}]`);
    parts.push(`${cut(ownInput, segment, duration)},atrim=end=${duration},volume=${own}[o${index}]`);
    parts.push(`[s${index}][o${index}]amix=inputs=2:duration=first:normalize=0,${fades}[a${index}]`);
  });
  if (isCrossfade) {
    let joined = "a0";
    for (let index = 1; index <= last; index++) {
      parts.push(`[${joined}][a${index}]acrossfade=d=${fadeSeconds}:c1=tri:c2=tri[x${index}]`);
      joined = `x${index}`;
    }
    const total = r3(edl.segments.reduce((sum, segment) => sum + r3(segment.end - segment.start), 0));
    parts.push(`[${joined}]afade=t=in:d=${fadeSeconds},afade=t=out:st=${r3(Math.max(0, total - fadeSeconds))}:d=${fadeSeconds}[speech]`);
  } else {
    const joined = edl.segments.map((_, index) => `[a${index}]`).join("");
    parts.push(`${joined}concat=n=${edl.segments.length}:v=0:a=1[speech]`);
  }
  return ["-v", "error", "-y", ...inputs, "-filter_complex", parts.join(";"), "-map", "[speech]", ...getAudioCodecArgs(output), output];
}

/**
 * The music track: looped to the film's length, ducked by the keyframes, faded in and faded out to the film's end over
 * `fadeOutSeconds` (default 1.5 s; the logo end card fades it over the card's whole length).
 */
export function buildMusicArgs(options: { input: string; seconds: number; keyframes: VolumeKeyframe[]; output: string; fadeOutSeconds?: number }): string[] {
  const { seconds } = options;
  const fadeOut = r3(Math.min(seconds, options.fadeOutSeconds ?? MUSIC_FADE_OUT));
  const filters = [
    `aformat=sample_rates=${FOOTAGE_SAMPLE_RATE}:channel_layouts=stereo`,
    `volume=eval=frame:volume='${volumeExpression(options.keyframes)}'`,
    `afade=t=in:d=${MUSIC_FADE_IN}`,
    `afade=t=out:st=${r3(Math.max(0, seconds - fadeOut))}:d=${fadeOut}`,
  ];
  return ["-v", "error", "-y", "-stream_loop", "-1", "-i", options.input, "-t", String(seconds), "-af", filters.join(","), "-c:a", "libmp3lame", "-q:a", "2", options.output];
}

/** A small silent copy of the cut, what Video to Music scores: each segment read from its own seek into its clip. */
export function buildCutPreviewArgs(edl: Edl, clips: Record<string, string>, output: string): string[] {
  const inputs: string[] = [];
  const parts: string[] = [];
  edl.segments.forEach((segment, index) => {
    const clip = clips[segment.clip];
    if (clip === undefined) throw new Error(`No file for clip "${segment.clip}" of the EDL.`);
    // Seeking the input (accurate while transcoding; normalized clips have a keyframe every half second) instead of
    // trim, which decodes the clip from its start for every segment.
    inputs.push("-ss", String(r3(segment.start)), "-t", String(r3(segment.end - segment.start)), "-i", clip);
    parts.push(`[${index}:v]setpts=PTS-STARTPTS,scale=540:-2,setsar=1[v${index}]`);
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

/** A file's sound alone, encoded by the output's extension (`getAudioCodecArgs`: `.wav` lossless). */
export function buildAudioArgs(clip: string, output: string): string[] {
  return ["-v", "error", "-y", "-i", clip, "-vn", ...getAudioCodecArgs(output), output];
}

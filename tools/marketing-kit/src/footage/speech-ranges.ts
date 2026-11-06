import { footageCacheKey, getFootageCachePath } from "./cache.js";
import { getSoundSpan, type Edl } from "./edl.js";
import type { ClipRole } from "./film.js";
import { FOOTAGE_SAMPLE_RATE } from "./normalize.js";

/**
 * The parts of each talking clip a cut hears, as ranges in whole milliseconds, and how their cleaned voice is laid
 * back over the clip's own sound: pure planning and ffmpeg argument builders for `isolateSpeechRanges` and the
 * per-range estimate, tested without ffmpeg.
 */

/** Seconds added on each side of a sound span, so a cut's cross-fade and fades read cleaned sound. */
export const DEFAULT_SPEECH_RANGE_MARGIN = 0.25;

/** A range of a clip's trimmed sound, in whole milliseconds (the cache key's unit). */
export interface SpeechRange {
  clip: string;
  startMs: number;
  endMs: number;
}

/** Where a range's cleaned sound is laid in its clip, in milliseconds; inside the range. */
export interface SpeechRangeWindow {
  range: SpeechRange;
  startMs: number;
  endMs: number;
}

export interface SpeechRangeClip {
  id: string;
  role: ClipRole;
  /** Seconds after the trim. */
  duration: number;
}

/**
 * The ranges the cut hears of each talking clip: every segment's sound span (its own clip's or `audio`'s), and the
 * picture clip's own span when `audio.ownVolume` keeps it under, widened by `margin` seconds on each side, clamped to
 * the clip and rounded out to whole milliseconds. Identical ranges and ranges inside another are dropped (the larger
 * one is laid there anyway); the rest are not merged, so a moved segment changes only its own range. Sorted by clip
 * order, then start.
 */
export function planSpeechRanges(edl: Edl, clips: readonly SpeechRangeClip[], options: { margin?: number } = {}): SpeechRange[] {
  const margin = Math.max(0, options.margin ?? DEFAULT_SPEECH_RANGE_MARGIN);
  const byId = new Map(clips.map((clip) => [clip.id, clip]));
  const found = new Map<string, SpeechRange[]>();
  const add = (span: { clip: string; start: number; end: number }): void => {
    const clip = byId.get(span.clip);
    if (clip === undefined || clip.role !== "talk") return;
    const clipMs = Math.floor(clip.duration * 1000);
    const startMs = Math.max(0, Math.floor((span.start - margin) * 1000));
    const endMs = Math.min(clipMs, Math.ceil((span.end + margin) * 1000));
    if (endMs <= startMs) return;
    const list = found.get(clip.id) ?? [];
    list.push({ clip: clip.id, startMs, endMs });
    found.set(clip.id, list);
  };
  for (const segment of edl.segments) {
    add(getSoundSpan(segment));
    if (segment.audio !== undefined && segment.audio.ownVolume > 0) add(segment);
  }
  const ranges: SpeechRange[] = [];
  for (const clip of clips) {
    const list = (found.get(clip.id) ?? []).sort((a, b) => a.startMs - b.startMs || b.endMs - a.endMs);
    for (const range of list) {
      const isInside = ranges.some((kept) => kept.clip === range.clip && kept.startMs <= range.startMs && kept.endMs >= range.endMs);
      if (!isInside) ranges.push(range);
    }
  }
  return ranges;
}

/**
 * Where each of one clip's ranges is laid: the whole range, except that two overlapping neighbours switch at the
 * middle of their overlap. Takes ranges of one clip, none inside another (as `planSpeechRanges` answers them).
 */
export function getSpeechRangeWindows(ranges: readonly SpeechRange[]): SpeechRangeWindow[] {
  const sorted = [...ranges].sort((a, b) => a.startMs - b.startMs);
  return sorted.map((range, index) => {
    const before = sorted[index - 1];
    const after = sorted[index + 1];
    const startMs = before !== undefined && before.endMs > range.startMs ? Math.round((range.startMs + before.endMs) / 2) : range.startMs;
    const endMs = after !== undefined && after.startMs < range.endMs ? Math.round((after.startMs + range.endMs) / 2) : range.endMs;
    return { range, startMs, endMs };
  });
}

/** The paid cache of one range's cleaned voice: keyed by the clip's identity, the range in milliseconds and the provider. */
export function getSpeechRangeCache(filmId: string, clipKey: string, range: SpeechRange, options: { cacheDir: string; provider: string }): { key: string; path: string } {
  const key = footageCacheKey("isolated", { clip: clipKey, range: [range.startMs, range.endMs], provider: options.provider });
  return { key, path: getFootageCachePath(options.cacheDir, filmId, "isolated", key) };
}

/** A range's paid cache entry, the app's own: its key (reported on the charge) and file. `clipKey` is the clip's identity. */
export type SpeechRangeCacheResolver = (range: SpeechRange, clipKey: string) => { key: string; path: string };

const seconds = (ms: number): string => (ms / 1000).toFixed(3);

/** One range of a clip's sound (`audio`, read from its start) as mp3, for the isolation provider. */
export function buildRangeAudioArgs(audio: string, range: Pick<SpeechRange, "startMs" | "endMs">, output: string): string[] {
  return ["-v", "error", "-y", "-ss", seconds(range.startMs), "-t", seconds(range.endMs - range.startMs), "-i", audio, "-vn", "-c:a", "libmp3lame", "-q:a", "2", output];
}

/** A cleaned range laid back: its file, and whether it is mono (panned to both channels at full level). */
export interface LaidRange {
  window: SpeechRangeWindow;
  file: string;
  isMono: boolean;
}

/** Milliseconds of the linear crossfade at every join between the clip's own sound and a cleaned window. */
export const DEFAULT_SPEECH_RANGE_FADE_MS = 15;

/** Where a window's cleaned sound fades in and out, in milliseconds of the clip: `inStart ≤ inEnd ≤ outStart ≤ outEnd`. */
export interface SpeechRangeFade {
  inStartMs: number;
  inEndMs: number;
  outStartMs: number;
  outEndMs: number;
}

/**
 * The crossfades of one clip's windows (as `getSpeechRangeWindows` answers them). At a switch between two overlapping
 * neighbours both ranges have sound, so the fade is centred on the switch, widened by half the fade on each side (at
 * most half the overlap) and shared by both windows, whose gains then sum to one. At a range's own edge the range has
 * no sound outside it, so the fade lies inside the window. No fade is longer than half its window.
 */
export function getSpeechRangeFades(windows: readonly SpeechRangeWindow[], fadeMs: number): SpeechRangeFade[] {
  const fade = Math.max(0, fadeMs);
  const sorted = [...windows].sort((a, b) => a.startMs - b.startMs);
  const halfWindow = (window: SpeechRangeWindow): number => (window.endMs - window.startMs) / 2;
  /** Half the shared fade at the switch between `before` and `after`; null when they do not overlap. */
  const getSwitchHalf = (before: SpeechRangeWindow | undefined, after: SpeechRangeWindow | undefined): number | null => {
    if (before === undefined || after === undefined || before.range.endMs <= after.range.startMs || before.endMs !== after.startMs) return null;
    const room = Math.min(before.range.endMs - before.endMs, after.startMs - after.range.startMs);
    return Math.floor(Math.min(fade / 2, room, halfWindow(before) / 2, halfWindow(after) / 2));
  };
  return sorted.map((window, index) => {
    const edge = Math.floor(Math.min(fade, halfWindow(window)));
    const startHalf = getSwitchHalf(sorted[index - 1], window);
    const endHalf = getSwitchHalf(window, sorted[index + 1]);
    const [inStartMs, inEndMs] = startHalf === null ? [window.startMs, window.startMs + edge] : [window.startMs - startHalf, window.startMs + startHalf];
    const [outStartMs, outEndMs] = endHalf === null ? [window.endMs - edge, window.endMs] : [window.endMs - endHalf, window.endMs + endHalf];
    return { inStartMs, inEndMs, outStartMs, outEndMs };
  });
}

/** The gain of a window with `fade` at time `t`, as an ffmpeg expression: 0 outside, 1 inside, linear in the fades. */
function buildGainExpression(fade: SpeechRangeFade): string {
  const rise = fade.inEndMs > fade.inStartMs ? `clip((t-${seconds(fade.inStartMs)})/${seconds(fade.inEndMs - fade.inStartMs)},0,1)` : `gte(t,${seconds(fade.inStartMs)})`;
  const fall = fade.outEndMs > fade.outStartMs ? `clip((${seconds(fade.outEndMs)}-t)/${seconds(fade.outEndMs - fade.outStartMs)},0,1)` : `lt(t,${seconds(fade.outEndMs)})`;
  return `min(${rise},${fall})`;
}

/**
 * The clip's own sound with each window replaced by its cleaned range, crossfaded at every join (`fadeMs`, default
 * `DEFAULT_SPEECH_RANGE_FADE_MS`; 0 switches at once): each window is cut from its cleaned file to its fade bounds,
 * faded in and out linearly and delayed into place in samples; the base is multiplied by one minus the windows'
 * gains, so the sum keeps its level. As long as the base; 48 kHz stereo like the speech track; a mono answer goes to
 * both channels as it is, not up-mixed at -3 dB.
 */
export function buildRangeLayArgs(base: string, laid: readonly LaidRange[], output: string, options: { fadeMs?: number } = {}): string[] {
  const format = `aformat=sample_rates=${FOOTAGE_SAMPLE_RATE}:channel_layouts=stereo`;
  if (laid.length === 0) return ["-v", "error", "-y", "-i", base, "-vn", "-af", format, "-c:a", "libmp3lame", "-q:a", "2", output];
  const windows = laid.map(({ window }) => window);
  const fades = getSpeechRangeFades(windows, options.fadeMs ?? DEFAULT_SPEECH_RANGE_FADE_MS);
  const byWindow = new Map([...windows].sort((a, b) => a.startMs - b.startMs).map((window, index) => [window, fades[index]]));
  const inputs = ["-i", base];
  const gains: string[] = [];
  const parts: string[] = [];
  laid.forEach(({ window, file, isMono }, index) => {
    const fade = byWindow.get(window);
    if (fade === undefined) return;
    inputs.push("-i", file);
    gains.push(buildGainExpression(fade));
    const channels = isMono ? "pan=stereo|c0=c0|c1=c0," : "";
    const fadeIn = fade.inEndMs > fade.inStartMs ? `,afade=t=in:st=0:d=${seconds(fade.inEndMs - fade.inStartMs)}` : "";
    const fadeOut = fade.outEndMs > fade.outStartMs ? `,afade=t=out:st=${seconds(fade.outStartMs - fade.inStartMs)}:d=${seconds(fade.outEndMs - fade.outStartMs)}` : "";
    const delay = Math.round((fade.inStartMs * FOOTAGE_SAMPLE_RATE) / 1000);
    parts.push(
      `[${index + 1}:a]atrim=start=${seconds(fade.inStartMs - window.range.startMs)}:end=${seconds(fade.outEndMs - window.range.startMs)},asetpts=PTS-STARTPTS,${channels}${format}${fadeIn}${fadeOut},adelay=${String(delay)}S:all=1[w${String(index)}]`,
    );
  });
  parts.unshift(`[0:a]${format},aeval='val(ch)*(1-(${gains.join("+")}))':c=same[base]`);
  const mixed = laid.map((_, index) => `[w${String(index)}]`).join("");
  parts.push(`[base]${mixed}amix=inputs=${String(laid.length + 1)}:duration=first:normalize=0[speech]`);
  return ["-v", "error", "-y", ...inputs, "-filter_complex", parts.join(";"), "-map", "[speech]", "-c:a", "libmp3lame", "-q:a", "2", output];
}

import { extname } from "node:path";

import { footageCacheKey, getFootageCachePath } from "./cache.js";
import { getAudioCodecArgs } from "./clip-sound.js";
import { getSoundSpan, type Edl } from "./edl.js";
import type { ClipRole } from "./film.js";
import { FOOTAGE_SAMPLE_RATE } from "./normalize.js";
import type { IsolationProvider } from "./providers.js";

/**
 * The parts of each talking clip a cut hears, as ranges in whole milliseconds, and how their cleaned voice is laid
 * back over the clip's own sound: pure planning and ffmpeg argument builders for `isolateSpeechRanges` and the
 * per-range estimate, tested without ffmpeg.
 */

/** Seconds added on each side of a sound span, so a cut's cross-fade and fades read cleaned sound. */
export const DEFAULT_SPEECH_RANGE_MARGIN = 0.25;

/** Seconds of the largest gap between two ranges of a clip that are isolated as one range (`planSpeechRanges`). */
export const DEFAULT_SPEECH_RANGE_MERGE_GAP = 2;

/** Seconds a range shorter than the provider's minimum is widened past it, so the cut file is safely long enough. */
export const DEFAULT_SPEECH_RANGE_MIN_PAD = 0.4;

/** Why a planned range is not sent: shorter than the provider's minimum even after merging and widening. */
export interface SpeechRangeSkip {
  reason: "too_short";
  /** The provider's minimum, in seconds. */
  minSeconds: number;
}

/** A range of a clip's trimmed sound, in whole milliseconds (the cache key's unit). */
export interface SpeechRange {
  clip: string;
  startMs: number;
  endMs: number;
  /**
   * The part of the range the cut hears, when the range was widened with the clip's own context to reach the
   * provider's minimum; absent: the whole range. Only this part of the cleaned voice is laid.
   */
  heard?: { startMs: number; endMs: number };
  /** Set when the range cannot pass the provider (the clip itself is shorter than its minimum): it is not sent. */
  skip?: SpeechRangeSkip;
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

export interface PlanSpeechRangesOptions {
  /** Seconds added on each side of a sound span; default `DEFAULT_SPEECH_RANGE_MARGIN` (0.25). */
  margin?: number;
  /** The isolation provider's minimum input in seconds (`IsolationProvider.minSeconds`); absent: no minimum. */
  minSeconds?: number;
  /**
   * Ranges of a clip at most this many seconds apart are isolated as one range; default
   * `DEFAULT_SPEECH_RANGE_MERGE_GAP` (2). `null` keeps every range apart (only identical ranges and ranges inside
   * another are dropped); `Infinity` isolates each clip's whole used span once.
   */
  mergeGap?: number | null;
  /** Seconds a range shorter than `minSeconds` is widened past it; default `DEFAULT_SPEECH_RANGE_MIN_PAD` (0.4). */
  minPad?: number;
}

/**
 * The source ranges to isolate of each talking clip: every segment's sound span (its own clip's or `audio`'s), and the
 * picture clip's own span when `audio.ownVolume` keeps it under, widened by `margin` seconds on each side, clamped to
 * the clip and rounded out to whole milliseconds. Identical ranges and ranges inside another are dropped; ranges of a
 * clip at most `mergeGap` seconds apart become one. With `minSeconds`, a range still shorter is widened symmetrically
 * with the clip's own context to `minSeconds + minPad` (shifted where the clip's edge stops it; `heard` keeps the part
 * the cut hears), ranges the widening brought within `mergeGap` are merged, and a range still shorter (a clip shorter
 * than the minimum) is marked `skip`. Sorted by clip order, then start.
 */
export function planSpeechRanges(edl: Edl, clips: readonly SpeechRangeClip[], options: PlanSpeechRangesOptions = {}): SpeechRange[] {
  const margin = Math.max(0, options.margin ?? DEFAULT_SPEECH_RANGE_MARGIN);
  const mergeGap = options.mergeGap === undefined ? DEFAULT_SPEECH_RANGE_MERGE_GAP : options.mergeGap;
  const gapMs = mergeGap === null ? null : Math.max(0, mergeGap) * 1000;
  const minSeconds = options.minSeconds !== undefined && options.minSeconds > 0 ? options.minSeconds : null;
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
    let kept: SpeechRange[] = [];
    for (const range of list) {
      const isInside = kept.some((other) => other.startMs <= range.startMs && other.endMs >= range.endMs);
      if (!isInside) kept.push(range);
    }
    if (gapMs !== null) kept = mergeSpeechRanges(kept, gapMs);
    if (minSeconds !== null) {
      const minMs = Math.ceil(minSeconds * 1000);
      const targetMs = Math.ceil((minSeconds + Math.max(0, options.minPad ?? DEFAULT_SPEECH_RANGE_MIN_PAD)) * 1000);
      const clipMs = Math.floor(clip.duration * 1000);
      kept = kept.map((range) => widenSpeechRange(range, { minMs, targetMs, clipMs }));
      if (gapMs !== null) kept = mergeSpeechRanges(kept, gapMs);
      kept = kept.map((range) => (range.endMs - range.startMs < minMs ? { ...range, skip: { reason: "too_short", minSeconds } } : range));
    }
    ranges.push(...kept);
  }
  return ranges;
}

/** How `isolateSpeechRanges` and the estimate plan the ranges: the caller's margin and merge gap, the provider's minimum. */
export function getPlanOptions(options: Pick<PlanSpeechRangesOptions, "margin" | "mergeGap" | "minPad">, isolation: IsolationProvider): PlanSpeechRangesOptions {
  return {
    ...(options.margin === undefined ? {} : { margin: options.margin }),
    ...(options.mergeGap === undefined ? {} : { mergeGap: options.mergeGap }),
    ...(options.minPad === undefined ? {} : { minPad: options.minPad }),
    ...(isolation.minSeconds === undefined ? {} : { minSeconds: isolation.minSeconds }),
  };
}

/** The part of a range the cut hears. */
function getHeard(range: SpeechRange): { startMs: number; endMs: number } {
  return range.heard ?? { startMs: range.startMs, endMs: range.endMs };
}

/** A range with `heard` set only when it is narrower than the range. */
function withHeard(range: Pick<SpeechRange, "clip" | "startMs" | "endMs">, heard: { startMs: number; endMs: number }): SpeechRange {
  const isWhole = heard.startMs <= range.startMs && heard.endMs >= range.endMs;
  return isWhole ? { clip: range.clip, startMs: range.startMs, endMs: range.endMs } : { clip: range.clip, startMs: range.startMs, endMs: range.endMs, heard };
}

/** One clip's ranges (sorted by start) with every two at most `gapMs` apart merged into one; the heard parts joined. */
function mergeSpeechRanges(ranges: readonly SpeechRange[], gapMs: number): SpeechRange[] {
  const merged: SpeechRange[] = [];
  for (const range of [...ranges].sort((a, b) => a.startMs - b.startMs)) {
    const last = merged.at(-1);
    if (last === undefined || range.startMs - last.endMs > gapMs) {
      merged.push(range);
      continue;
    }
    const lastHeard = getHeard(last);
    const heard = getHeard(range);
    merged[merged.length - 1] = withHeard(
      { clip: last.clip, startMs: last.startMs, endMs: Math.max(last.endMs, range.endMs) },
      { startMs: Math.min(lastHeard.startMs, heard.startMs), endMs: Math.max(lastHeard.endMs, heard.endMs) },
    );
  }
  return merged;
}

/** A range shorter than `minMs` widened symmetrically to `targetMs` with the clip's own context, inside the clip. */
function widenSpeechRange(range: SpeechRange, limits: { minMs: number; targetMs: number; clipMs: number }): SpeechRange {
  const length = range.endMs - range.startMs;
  if (length >= limits.minMs) return range;
  const target = Math.min(limits.targetMs, limits.clipMs);
  const endMs = Math.min(limits.clipMs, Math.max(0, range.startMs - Math.floor((target - length) / 2)) + target);
  const startMs = Math.max(0, endMs - target);
  return withHeard({ clip: range.clip, startMs, endMs }, getHeard(range));
}

/**
 * Where each of one clip's ranges is laid: the part the cut hears (`heard`, else the whole range), except that two
 * overlapping neighbours switch at the middle of their overlap. Takes ranges of one clip, none inside another (as
 * `planSpeechRanges` answers them).
 */
export function getSpeechRangeWindows(ranges: readonly SpeechRange[]): SpeechRangeWindow[] {
  const sorted = [...ranges].sort((a, b) => getHeard(a).startMs - getHeard(b).startMs);
  return sorted.map((range, index) => {
    const heard = getHeard(range);
    const before = sorted[index - 1];
    const after = sorted[index + 1];
    const beforeEnd = before === undefined ? null : getHeard(before).endMs;
    const afterStart = after === undefined ? null : getHeard(after).startMs;
    const startMs = beforeEnd !== null && beforeEnd > heard.startMs ? Math.round((heard.startMs + beforeEnd) / 2) : heard.startMs;
    const endMs = afterStart !== null && afterStart < heard.endMs ? Math.round((afterStart + heard.endMs) / 2) : heard.endMs;
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

/**
 * One range of a clip's sound (`audio`, read from its start) for the isolation provider: 24-bit PCM for a `.wav`
 * output (lossless, issue #1139), else as `getAudioCodecArgs` encodes it.
 */
export function buildRangeAudioArgs(audio: string, range: Pick<SpeechRange, "startMs" | "endMs">, output: string): string[] {
  const codec = extname(output).toLowerCase() === ".wav" ? ["-c:a", "pcm_s24le"] : getAudioCodecArgs(output);
  return ["-v", "error", "-y", "-ss", seconds(range.startMs), "-t", seconds(range.endMs - range.startMs), "-i", audio, "-vn", ...codec, output];
}

/**
 * A cleaned range laid back: its file, whether it is mono (panned to both channels at full level), and the dB it is
 * raised by before its fades (`gainDb`, issue #1159: a range cut from the clip's un-gained sound is raised by the
 * clip's pre-gain; absent or 0 leaves it as it is).
 */
export interface LaidRange {
  window: SpeechRangeWindow;
  file: string;
  isMono: boolean;
  gainDb?: number;
}

/**
 * Where the gain of the sound a range's cleaned voice was cut from is recorded (issue #1159): next to its cached file,
 * as `<path>.gain.json` holding `{ "inputGainDb": <dB> }`. Commit it with the cached file.
 */
export function getSpeechRangeGainPath(path: string): string {
  return `${path}.gain.json`;
}

/** The record of `getSpeechRangeGainPath`'s file. */
export function formatSpeechRangeGain(inputGainDb: number): string {
  return `${JSON.stringify({ inputGainDb })}\n`;
}

/** The input gain in a record's text; null when the text is not such a record. */
export function readSpeechRangeGain(text: string): number | null {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof json !== "object" || json === null) return null;
  const value = (json as Record<string, unknown>).inputGainDb;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** A measuring pass (`loudnorm`, nothing written) over `file`, or only over `range` of it, as 48 kHz stereo. */
export function buildRangeMeasureArgs(file: string, range?: Pick<SpeechRange, "startMs" | "endMs">): string[] {
  const window = range === undefined ? [] : ["-ss", seconds(range.startMs), "-t", seconds(range.endMs - range.startMs)];
  const format = `aformat=sample_rates=${String(FOOTAGE_SAMPLE_RATE)}:channel_layouts=stereo`;
  return ["-hide_banner", "-nostats", ...window, "-i", file, "-map", "0:a:0", "-vn", "-af", `${format},loudnorm=I=-23:TP=-2:LRA=11:print_format=json`, "-f", "null", "-"];
}

/**
 * The gain of the sound a cached cleaned range was cut from, told from its loudness (issue #1159): a range cut from
 * the clip's un-gained sound sits about `clipGainDb` under the same range of the pre-gained sound, one cut from the
 * pre-gained sound about level with it (the cleaning takes off a few dB at most). The nearer case wins: 0 (un-gained)
 * or `clipGainDb`. Without a loudness on either side (null: silence) it is `clipGainDb`, so nothing is changed.
 */
export function getRangeInputGainDb(options: { clipGainDb: number; cleanedLufs: number | null; baseLufs: number | null }): number {
  const { clipGainDb, cleanedLufs, baseLufs } = options;
  if (clipGainDb === 0 || cleanedLufs === null || baseLufs === null) return clipGainDb;
  const difference = cleanedLufs - baseLufs;
  return Math.abs(difference + clipGainDb) < Math.abs(difference) ? 0 : clipGainDb;
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
  if (laid.length === 0) return ["-v", "error", "-y", "-i", base, "-vn", "-af", format, ...getAudioCodecArgs(output), output];
  const windows = laid.map(({ window }) => window);
  const fades = getSpeechRangeFades(windows, options.fadeMs ?? DEFAULT_SPEECH_RANGE_FADE_MS);
  const byWindow = new Map([...windows].sort((a, b) => a.startMs - b.startMs).map((window, index) => [window, fades[index]]));
  const inputs = ["-i", base];
  const gains: string[] = [];
  const parts: string[] = [];
  laid.forEach(({ window, file, isMono, gainDb }, index) => {
    const fade = byWindow.get(window);
    if (fade === undefined) return;
    inputs.push("-i", file);
    gains.push(buildGainExpression(fade));
    const channels = isMono ? "pan=stereo|c0=c0|c1=c0," : "";
    const volume = gainDb === undefined || gainDb === 0 ? "" : `,volume=${String(gainDb)}dB`;
    const fadeIn = fade.inEndMs > fade.inStartMs ? `,afade=t=in:st=0:d=${seconds(fade.inEndMs - fade.inStartMs)}` : "";
    const fadeOut = fade.outEndMs > fade.outStartMs ? `,afade=t=out:st=${seconds(fade.outStartMs - fade.inStartMs)}:d=${seconds(fade.outEndMs - fade.outStartMs)}` : "";
    const delay = Math.round((fade.inStartMs * FOOTAGE_SAMPLE_RATE) / 1000);
    parts.push(
      `[${index + 1}:a]atrim=start=${seconds(fade.inStartMs - window.range.startMs)}:end=${seconds(fade.outEndMs - window.range.startMs)},asetpts=PTS-STARTPTS,${channels}${format}${volume}${fadeIn}${fadeOut},adelay=${String(delay)}S:all=1[w${String(index)}]`,
    );
  });
  parts.unshift(`[0:a]${format},aeval='val(ch)*(1-(${gains.join("+")}))':c=same[base]`);
  const mixed = laid.map((_, index) => `[w${String(index)}]`).join("");
  parts.push(`[base]${mixed}amix=inputs=${String(laid.length + 1)}:duration=first:normalize=0[speech]`);
  return ["-v", "error", "-y", ...inputs, "-filter_complex", parts.join(";"), "-map", "[speech]", ...getAudioCodecArgs(output), output];
}

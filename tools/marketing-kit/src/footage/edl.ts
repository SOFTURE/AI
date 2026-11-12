import { z } from "zod";

import type { TimedWord } from "../voice/voiceover.js";
import { cameraSchema, describeCamera, isSameCamera, type EdlCamera } from "./camera.js";
import { overlaySchema, type EdlOverlay } from "./overlay-schema.js";
import { DRAWN_TRANSITION_FRAMES, isDrawnTransition, STUTTER_FRAMES } from "./drawn-transitions.js";
import { FOOTAGE_FPS } from "./normalize.js";
import { findSplitCaptionProblems, findSplitLabelProblems, splitSchema, type EdlSplit } from "./split-screen.js";
import { CUT_TRANSITIONS, type ClipRole, type CutOptions, type CutTransition, type FootageTransitions } from "./film.js";
import { splitFilmSentences, type Sentence } from "./sentences.js";
import { isFiller } from "./words.js";

export { isFiller, normalizeWord } from "./words.js";

/**
 * The edit decision list: which parts of which clips the film keeps, in order, and how each part starts. Built from
 * the transcript (`buildEdl`), written as plain JSON next to the build so a person or an agent can check or change it
 * before the render, and read back through `edlSchema`.
 */

export const SEGMENT_MOTIONS = ["none", "kenburns"] as const;

export type SegmentMotion = (typeof SEGMENT_MOTIONS)[number];

/** A segment's sound taken from another clip or span: a J- or L-cut, or b-roll over speech. */
export interface EdlAudio {
  clip: string;
  /** Seconds in that trimmed clip; as long as the segment. */
  start: number;
  end: number;
  /** The picture clip's own sound under it (0-1); 0 mutes it. */
  ownVolume: number;
}

/**
 * A segment's own caption box, merged over the film's (`getFootageCaptionLayout`) for the captions that start in it.
 * Px of the film's frame, as `CaptionLayout`: `bottom` anchors the box by its foot (above the frame's foot) and wins;
 * `top` alone hangs the box from that top.
 */
export interface EdlCaption {
  bottom?: number;
  top?: number;
}

/**
 * The caption box for a stretch of film time, over the segment's (`EdlCaption`): the caption chunks said between
 * `from` and `to` (film seconds, `to` excluded) take it, so captions can clear something shown for part of a segment
 * without splitting the cut. Px of the film's frame, as `EdlCaption`.
 */
export interface EdlCaptionRange extends EdlCaption {
  from: number;
  to: number;
}

export interface EdlSegment {
  /** Unique in the cut: `s<n>` (the sentence it starts with), `r<n>` (b-roll), `w<n>` (a talking clip without words). */
  id: string;
  /** The clip's id (the picture, and the sound unless `audio` says otherwise). */
  clip: string;
  /** Seconds in the trimmed clip. */
  start: number;
  end: number;
  transition: CutTransition;
  /** `kenburns`: a slow zoom over a segment without speech. */
  motion: SegmentMotion;
  /** The segment's framing and a slow move over it (`camera.ts`); absent: the film's own zoom (cuts, Ken Burns). */
  camera?: EdlCamera;
  /** A `fade` cut's own length in frames at 30 fps (1-30); absent: the film's `fadeFrames`. */
  fadeFrames?: number;
  audio?: EdlAudio;
  /** Moves the caption box for the captions that start in this segment; absent: the film's box. */
  caption?: EdlCaption;
  /** A split screen (`split-screen.ts`): the picture is three shots stacked in bands; absent: the segment's own clip. */
  split?: EdlSplit;
}

export interface Edl {
  version: 2;
  film: string;
  segments: EdlSegment[];
  /**
   * Small graphics and emphasis zooms on words of the transcript (`overlays.ts`, issue #1200); absent or empty: none,
   * and the film is drawn as without the field.
   */
  overlays?: EdlOverlay[];
  /** Caption boxes for stretches of film time, over the segments' own (`EdlCaptionRange`); absent or empty: none. */
  captionRanges?: EdlCaptionRange[];
}

/** The shortest and the longest a segment's own `fadeFrames` may be. */
export const MIN_FADE_FRAMES = 1;
export const MAX_FADE_FRAMES = 30;

const SEGMENT_ID_PATTERN = /^[A-Za-z0-9._-]+$/;

const segmentFields = {
  clip: z.string().min(1).describe("The clip's id: the picture, and the sound unless audio says otherwise."),
  start: z.number().min(0).describe("Seconds in the trimmed clip where the segment starts."),
  end: z.number().positive().describe("Seconds in the trimmed clip where the segment ends."),
  transition: z.enum(CUT_TRANSITIONS).describe("How the segment starts: cut, fade (a cross-fade from the segment before), zoom (a punch-in), whoosh, whip (a whip pan with motion blur, 14 frames), card (the shot grows from a small card, 13 frames), paper (a torn-paper wipe, 12 frames) or stutter (5 frames wide, then tight)."),
  motion: z.enum(SEGMENT_MOTIONS).describe("kenburns: a slow zoom over the segment; none: still."),
};

export const edlSchema = z
  .strictObject({
    version: z.literal(2).describe("The EDL format: 2."),
    film: z.string().min(1).describe("The footage film's id."),
    segments: z
      .array(
        z.strictObject({
          id: z.string().regex(SEGMENT_ID_PATTERN, "letters, digits, dot, dash or underscore").describe("The segment's id, unique in the cut: s<n> for a sentence, r<n> for b-roll."),
          ...segmentFields,
          camera: cameraSchema.optional(),
          fadeFrames: z.number().int().min(MIN_FADE_FRAMES).max(MAX_FADE_FRAMES).optional().describe("A fade cut's own length in frames at 30 fps (1-30); absent: the film's fadeFrames. Only on a fade."),
          audio: z
            .strictObject({
              clip: z.string().min(1).describe("The clip the sound comes from."),
              start: z.number().min(0).describe("Seconds in that trimmed clip where the sound starts."),
              end: z.number().positive().describe("Seconds in that trimmed clip where the sound ends; end - start equals the segment's length."),
              ownVolume: z.number().min(0).max(1).default(0).describe("The picture clip's own sound under it (0-1, default 0: muted)."),
            })
            .optional()
            .describe("Sound from another clip or span: a J- or L-cut, or b-roll over speech. Without it, the segment plays its own sound."),
          caption: z
            .strictObject({
              bottom: z.number().min(0).optional().describe("The caption box's foot, in px above the frame's foot; anchors the box by its foot and wins over top."),
              top: z.number().min(0).optional().describe("The caption box's top, in px below the frame's top; used when bottom is absent."),
            })
            .optional()
            .describe("Moves the caption box for the captions that start in this segment (px of the film's frame). Without it, the film's caption box."),
          split: splitSchema.optional(),
        }),
      )
      .min(1, "the cut needs at least one segment")
      .describe("The kept parts of the clips, in film order."),
    overlays: z
      .array(overlaySchema)
      .max(40)
      .optional()
      .describe(
        "Small graphics and emphasis zooms placed on a word of the transcript (at_word) or a film second (at), one at a time, each inside one shot (one segment, or segments of one clip joined by plain cuts, with no Ken Burns zoom and the same caption box; a punch_in inside one segment): punch_in, keyword, lower_third, list, arrow, highlight, search_bar, place_card, counter, date_stamp; and a hook_title at the top, which may stay across cuts beside the others. Without it, none.",
      ),
    captionRanges: z
      .array(
        z.strictObject({
          from: z.number().min(0).describe("Film second where the stretch starts."),
          to: z.number().positive().describe("Film second where the stretch ends (excluded)."),
          bottom: z.number().min(0).optional().describe("The caption box's foot, in px above the frame's foot; anchors the box by its foot and wins over top."),
          top: z.number().min(0).optional().describe("The caption box's top, in px below the frame's top; used when bottom is absent."),
        }),
      )
      .max(40)
      .optional()
      .describe("Moves the caption box for the captions said in a stretch of film time (from to to, in film seconds), over the segment's own caption; stretches never overlap. Without it, the segments' boxes."),
  })
  .describe("The edit decision list of a footage film (edl.json).");

/** Version 1 (no ids, no audio), still read from build folders and upgraded. */
const edlV1Schema = z.strictObject({
  version: z.literal(1),
  film: z.string().min(1),
  segments: z.array(z.strictObject(segmentFields)).min(1, "the cut needs at least one segment"),
});

/** The EDL's JSON Schema, for an agent or an MCP tool that edits `edl.json`. */
export function getEdlJsonSchema(): Record<string, unknown> {
  return { ...z.toJSONSchema(edlSchema, { io: "input" }), title: "edl.json of a footage film (@softure-ai/marketing-kit)" };
}

/** A clip as the cut sees it: its role, its trimmed length and its transcript (times from the trimmed start). */
export interface EdlClip {
  id: string;
  role: ClipRole;
  duration: number;
  words: TimedWord[];
}

/** Shortest segment kept, in seconds: anything shorter reads as a glitch. */
export const MIN_SEGMENT_SECONDS = 0.25;

const r3 = (value: number): number => Math.round(value * 1000) / 1000 || 0;

interface Span {
  start: number;
  end: number;
  /** The sentence the span's first word belongs to. */
  sentence: string | null;
}

/**
 * The kept spans of a talking clip: runs of spoken words split at fillers, long pauses and words of dropped sentences,
 * padded, never into a neighbour word.
 */
function getTalkSpans(clip: EdlClip, options: CutOptions, sentenceOf: Map<TimedWord, Sentence>, isKept: (word: TimedWord) => boolean): Span[] {
  const runs: TimedWord[][] = [];
  let run: TimedWord[] = [];
  const words = [...clip.words].sort((a, b) => a.start - b.start);
  words.forEach((word, index) => {
    const previous = words[index - 1];
    if (isFiller(word.text, options.fillers) || !isKept(word)) {
      if (run.length > 0) runs.push(run);
      run = [];
      return;
    }
    if (run.length > 0 && previous !== undefined && word.start - previous.end > options.pauseSeconds) {
      runs.push(run);
      run = [];
    }
    run.push(word);
  });
  if (run.length > 0) runs.push(run);
  const spans: Span[] = [];
  for (const kept of runs) {
    const first = kept[0] as TimedWord;
    const last = kept[kept.length - 1] as TimedWord;
    const before = words[words.indexOf(first) - 1];
    const after = words[words.indexOf(last) + 1];
    const start = Math.max(0, first.start - options.padSeconds, before?.end ?? 0);
    const end = Math.min(clip.duration, last.end + options.padSeconds, after?.start ?? clip.duration);
    const previous = spans.at(-1);
    if (previous !== undefined && start <= previous.end + 0.01) previous.end = Math.max(previous.end, end);
    else spans.push({ start, end, sentence: sentenceOf.get(first)?.id ?? null });
  }
  return spans.filter((span) => span.end - span.start >= MIN_SEGMENT_SECONDS);
}

/** Cuts the segments to `maxSeconds`: the last one that crosses it is shortened, later ones dropped. */
function limitLength(segments: EdlSegment[], maxSeconds: number | null): EdlSegment[] {
  if (maxSeconds === null) return segments;
  const kept: EdlSegment[] = [];
  let total = 0;
  for (const segment of segments) {
    const left = maxSeconds - total;
    if (left < MIN_SEGMENT_SECONDS) break;
    const length = segment.end - segment.start;
    kept.push(length <= left ? segment : { ...segment, end: r3(segment.start + left) });
    total += Math.min(length, left);
  }
  return kept;
}

export interface BuildEdlOptions {
  /** The sentence ids (`splitFilmSentences`) to keep; the words of every other sentence are cut. Absent: all. */
  keepSentences?: readonly string[];
  /** Mark b-roll segments `kenburns` (a slow zoom); false keeps them still. */
  isKenBurns?: boolean;
}

/** A unique id from a base: `s3`, then `s3.2`, `s3.3` for later segments of the same sentence. */
function claimId(base: string, used: Set<string>): string {
  let id = base;
  for (let n = 2; used.has(id); n++) id = `${base}.${n}`;
  used.add(id);
  return id;
}

/**
 * The cut from the transcripts. A talking clip keeps its runs of words: fillers are cut out, a pause longer than
 * `pauseSeconds` is cut, `padSeconds` stays around each cut, and with `keepSentences` only those sentences stay. A
 * talking clip without words, and every b-roll clip, is kept whole. The first segment starts with a cut; later ones
 * with `transitions.jump` inside one clip (a plain cut for `auto`, chosen later from the frames by
 * `chooseCutTransitions`) and `transitions.clip` between clips. Each segment's id names the sentence
 * it starts with (`s4`), or the b-roll (`r1`) or wordless clip (`w1`) it shows.
 */
export function buildEdl(filmId: string, clips: EdlClip[], options: CutOptions, transitions: FootageTransitions, edit: BuildEdlOptions = {}): Edl {
  const sentences = splitFilmSentences(clips);
  const sentenceOf = new Map<TimedWord, Sentence>();
  for (const sentence of sentences) for (const word of sentence.words) sentenceOf.set(word, sentence);
  const keep = edit.keepSentences === undefined ? null : new Set(edit.keepSentences);
  const isKept = (word: TimedWord): boolean => keep === null || keep.has(sentenceOf.get(word)?.id ?? "");
  const segments: EdlSegment[] = [];
  const used = new Set<string>();
  let broll = 0;
  let wordless = 0;
  for (const clip of clips) {
    const hasWords = clip.role === "talk" && clip.words.length > 0;
    const spans: Span[] = hasWords ? getTalkSpans(clip, options, sentenceOf, isKept) : [{ start: 0, end: clip.duration, sentence: null }];
    // A talking clip whose sentences were all dropped (or cut to nothing) leaves the film.
    for (const span of spans) {
      const previous = segments.at(-1);
      // An auto jump cut starts as a plain cut; `chooseCutTransitions` sets it from the frames.
      const jump = transitions.jump === "auto" ? "cut" : transitions.jump;
      const transition = previous === undefined ? "cut" : previous.clip === clip.id ? jump : transitions.clip;
      const base = span.sentence ?? (clip.role === "broll" ? `r${++broll}` : `w${++wordless}`);
      const motion = clip.role === "broll" && edit.isKenBurns === true ? "kenburns" : "none";
      segments.push({ id: claimId(base, used), clip: clip.id, start: r3(span.start), end: r3(span.end), transition, motion });
    }
  }
  return { version: 2, film: filmId, segments: limitLength(segments, options.maxSeconds) };
}

/** The clip and span a segment's sound comes from: its `audio`, or its own picture span. */
export function getSoundSpan(segment: EdlSegment): { clip: string; start: number; end: number } {
  return segment.audio ?? { clip: segment.clip, start: segment.start, end: segment.end };
}

/** The frame a segment's caption box must stay in: its height and the height of a one-line caption card, in px. */
export interface EdlCaptionBounds {
  frameHeight: number;
  cardHeight: number;
  /** The frame's width, for a split screen's labels; absent: a 9:16 frame's (`frameHeight` × 9 / 16). */
  frameWidth?: number;
}

/**
 * What makes an EDL (a hand-edited one above all) unusable with these clips; empty when it is fine: another film,
 * an unknown clip, a span past a clip's end, a too short segment, a repeated id, a sound span of another length, and
 * (with `captionBounds`) a segment's caption box that would leave the frame.
 */
export function validateEdl(edl: Edl, clips: Pick<EdlClip, "id" | "duration">[], filmId: string, captionBounds?: EdlCaptionBounds): string[] {
  const problems: string[] = [];
  if (edl.film !== filmId) problems.push(`it belongs to film "${edl.film}", not "${filmId}"`);
  const durations = new Map(clips.map((clip) => [clip.id, clip.duration]));
  const seen = new Set<string>();
  const checkSpan = (at: string, span: { clip: string; start: number; end: number }) => {
    const duration = durations.get(span.clip);
    if (duration === undefined) problems.push(`${at}.clip: no clip "${span.clip}" in the film`);
    else if (span.end > duration + 0.05) problems.push(`${at}.end: ${span.end} s is past the clip's end (${duration.toFixed(2)} s)`);
  };
  edl.segments.forEach((segment, index) => {
    const at = `segments[${index}]`;
    if (seen.has(segment.id)) problems.push(`${at}.id: "${segment.id}" appears twice`);
    seen.add(segment.id);
    checkSpan(at, segment);
    if (segment.end - segment.start < MIN_SEGMENT_SECONDS) problems.push(`${at}: shorter than ${MIN_SEGMENT_SECONDS} s (start ${segment.start}, end ${segment.end})`);
    if (captionBounds !== undefined) problems.push(...findCaptionProblems(`${at}.caption`, segment.caption, captionBounds));
    problems.push(...findCameraProblems(at, segment));
    if (segment.split !== undefined) problems.push(...findSplitProblems({ edl, index, split: segment.split, checkSpan, captionBounds }));
    const { audio } = segment;
    if (audio === undefined) return;
    checkSpan(`${at}.audio`, audio);
    const length = r3(segment.end - segment.start);
    const soundLength = r3(audio.end - audio.start);
    if (Math.abs(length - soundLength) > 0.05) problems.push(`${at}.audio: ${soundLength} s of sound for ${length} s of picture (end - start must match)`);
  });
  problems.push(...findCaptionRangeProblems(edl, captionBounds));
  return problems;
}

/** The 1080 px wide 9:16 frame a split screen's labels are measured in when no bounds name the frame. */
const SPLIT_CHECK_FRAME = { width: 1080, height: 1920 };

/**
 * What makes a split screen unusable: a band's clip missing or too short for the segment, a zoom of its own (a camera,
 * Ken Burns, a zoom or stutter cut: the bands hold still), the cut's last segment (the end card's backdrop is one
 * shot), the segment after it starting on a fade or a drawn transition (its outgoing tail is one shot), a label too
 * wide, and (with `captionBounds`) captions that would cover a label or an arrow.
 */
function findSplitProblems(input: { edl: Edl; index: number; split: EdlSplit; checkSpan: (at: string, span: { clip: string; start: number; end: number }) => void; captionBounds: EdlCaptionBounds | undefined }): string[] {
  const { edl, index, split, captionBounds } = input;
  const segment = edl.segments[index] as EdlSegment;
  const at = `segments[${String(index)}].split`;
  const length = segment.end - segment.start;
  const problems: string[] = [];
  split.bands.forEach((band, bandIndex) => input.checkSpan(`${at}.bands[${String(bandIndex)}]`, { clip: band.clip, start: band.start, end: r3(band.start + length) }));
  if (segment.camera !== undefined) problems.push(`${at}: a split screen holds still; drop the segment's camera`);
  if (segment.motion === "kenburns") problems.push(`${at}: a split screen holds still; set motion to none`);
  if (segment.transition === "zoom" || segment.transition === "stutter") problems.push(`${at}: a split screen holds still; start it on a cut or a fade, not a ${segment.transition}`);
  const next = edl.segments[index + 1];
  if (next === undefined) problems.push(`${at}: a split screen cannot end the cut (the end card's backdrop is one shot); put a full shot after it`);
  else if (next.transition === "fade" || isDrawnTransition(next.transition)) problems.push(`${at}: the segment after a split screen starts on a ${next.transition}; start "${next.id}" on a cut`);
  const frame = captionBounds === undefined ? SPLIT_CHECK_FRAME : { width: captionBounds.frameWidth ?? Math.round((captionBounds.frameHeight * 9) / 16), height: captionBounds.frameHeight };
  problems.push(...findSplitLabelProblems(split, frame, at));
  if (captionBounds === undefined) return problems;
  const ranges = (edl.captionRanges ?? []).filter((range) => {
    const start = getSegmentStarts(edl)[index] as number;
    return range.from < start + length && start < range.to;
  });
  problems.push(...findSplitCaptionProblems({ at: `segments[${String(index)}]`, caption: segment.caption, frame, cardHeight: captionBounds.cardHeight }));
  for (const range of ranges) {
    const which = (edl.captionRanges ?? []).indexOf(range);
    problems.push(...findSplitCaptionProblems({ at: `captionRanges[${String(which)}]`, caption: range, frame, cardHeight: captionBounds.cardHeight }).map((problem) => problem.replace(`captionRanges[${String(which)}].caption`, `captionRanges[${String(which)}]`)));
  }
  return problems;
}

/** A camera beside the film's own zoom (a Ken Burns zoom, a zoom cut), which owns the scale too, and a fade length on another cut. */
function findCameraProblems(at: string, segment: EdlSegment): string[] {
  const problems: string[] = [];
  if (segment.fadeFrames !== undefined && segment.transition !== "fade") problems.push(`${at}.fadeFrames: only a fade cut has a length; this segment starts on a ${segment.transition}`);
  problems.push(...findTransitionProblems(at, segment));
  if (segment.camera === undefined) return problems;
  if (segment.motion === "kenburns") problems.push(`${at}.camera: the segment has a Ken Burns zoom, which owns the picture's scale; set motion to none or drop the camera`);
  if (segment.transition === "zoom") problems.push(`${at}.camera: the segment starts on a zoom cut, which owns the picture's scale; start it on a cut or a fade`);
  return problems;
}

/**
 * A drawn transition on a segment shorter than its frames (its head is the transition), and a stutter beside a zoom of
 * its own: a moving camera or a Ken Burns zoom (the stutter holds one tight framing after its wide frames).
 */
function findTransitionProblems(at: string, segment: EdlSegment): string[] {
  const problems: string[] = [];
  const frames = Math.round((segment.end - segment.start) * FOOTAGE_FPS);
  if (isDrawnTransition(segment.transition) && frames <= DRAWN_TRANSITION_FRAMES[segment.transition]) {
    problems.push(`${at}.transition: a ${segment.transition} takes ${String(DRAWN_TRANSITION_FRAMES[segment.transition])} frames, longer than the segment (${String(frames)} frames)`);
  }
  if (segment.transition !== "stutter") return problems;
  if (frames <= STUTTER_FRAMES) problems.push(`${at}.transition: a stutter shows ${String(STUTTER_FRAMES)} wide frames first, longer than the segment (${String(frames)} frames)`);
  if (segment.motion === "kenburns") problems.push(`${at}.transition: a stutter holds one tight framing; the segment's Ken Burns zoom would move it`);
  if (segment.camera !== undefined && segment.camera.from !== segment.camera.to) problems.push(`${at}.transition: a stutter holds one tight framing; the segment's camera moves`);
  return problems;
}

/** Caption ranges that are empty, run past the cut, overlap one another or (with `captionBounds`) leave the frame. */
function findCaptionRangeProblems(edl: Edl, captionBounds: EdlCaptionBounds | undefined): string[] {
  const problems: string[] = [];
  const duration = getEdlDuration(edl);
  const ranges = edl.captionRanges ?? [];
  ranges.forEach((range, index) => {
    const at = `captionRanges[${index}]`;
    if (range.to <= range.from) problems.push(`${at}: to (${range.to} s) must come after from (${range.from} s)`);
    if (range.to > duration + 0.05) problems.push(`${at}.to: ${range.to} s is past the cut's end (${duration} s)`);
    const other = ranges.findIndex((candidate, j) => j < index && candidate.from < range.to && range.from < candidate.to);
    if (other !== -1) problems.push(`${at}: overlaps captionRanges[${other}] (${formatSpan({ start: range.from, end: range.to })})`);
    if (captionBounds !== undefined) problems.push(...findCaptionProblems(at, range, captionBounds));
  });
  return problems;
}

/** A caption box's edges past the frame: each edge at most the frame's height minus one card, so a card always fits. */
function findCaptionProblems(at: string, caption: EdlCaption | undefined, bounds: EdlCaptionBounds): string[] {
  const limit = Math.round(bounds.frameHeight - bounds.cardHeight);
  const problems: string[] = [];
  for (const edge of ["bottom", "top"] as const) {
    const value = caption?.[edge];
    if (value === undefined) continue;
    if (value < 0) problems.push(`${at}.${edge}: ${value} px is outside the frame`);
    else if (value > limit) problems.push(`${at}.${edge}: ${value} px leaves no room for a caption card (at most ${limit} px in a ${bounds.frameHeight} px frame)`);
  }
  return problems;
}

/** `validateEdl` under its first name. */
export const findEdlProblems = validateEdl;

/** Reads an EDL file's JSON (version 2, or version 1 upgraded with generated ids); an error names the first problems by path. */
export function readEdl(json: unknown): { ok: true; edl: Edl } | { ok: false; error: string } {
  const isVersion1 = typeof json === "object" && json !== null && (json as { version?: unknown }).version === 1;
  if (isVersion1) {
    const old = edlV1Schema.safeParse(json);
    if (!old.success) return { ok: false, error: formatIssues(old.error.issues) };
    const used = new Set<string>();
    return { ok: true, edl: { version: 2, film: old.data.film, segments: old.data.segments.map((segment, index) => ({ id: claimId(`seg${index + 1}`, used), ...segment })) } };
  }
  const parsed = edlSchema.safeParse(json);
  return parsed.success ? { ok: true, edl: parsed.data } : { ok: false, error: formatIssues(parsed.error.issues) };
}

function formatIssues(issues: z.core.$ZodIssue[]): string {
  return issues
    .slice(0, 5)
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("; ");
}

const formatSpan = (span: { start: number; end: number }): string => `${span.start}–${span.end} s`;

/** The ids of `order` that keep their relative order (a longest increasing run by their place in `before`). */
function findStayingIds(order: string[], before: Map<string, number>): Set<string> {
  const places = order.map((id) => before.get(id) ?? 0);
  const lengths = places.map(() => 1);
  const links = places.map(() => -1);
  places.forEach((place, i) => {
    for (let j = 0; j < i; j++) {
      if ((places[j] ?? 0) < place && (lengths[j] ?? 0) + 1 > (lengths[i] ?? 0)) {
        lengths[i] = (lengths[j] ?? 0) + 1;
        links[i] = j;
      }
    }
  });
  const staying = new Set<string>();
  let index = lengths.indexOf(Math.max(0, ...lengths));
  while (index !== -1) {
    staying.add(order[index] as string);
    index = links[index] ?? -1;
  }
  return staying;
}

/** The segment of `edl` whose sound or picture covers the middle of a sound span, to name a J/L-cut or b-roll over speech. */
function findSpeaker(edl: Edl, span: { clip: string; start: number; end: number }, self: string): string | null {
  const middle = (span.start + span.end) / 2;
  const match = edl.segments.find((segment) => segment.id !== self && segment.clip === span.clip && segment.start <= middle && middle < segment.end);
  return match?.id ?? null;
}

/** What an edit changed, from `before` to `after`, as short lines ("dropped s3", "moved s7 to the start", "r1 over s4"). */
export function diffEdl(before: Edl, after: Edl): string[] {
  const lines: string[] = [];
  const old = new Map(before.segments.map((segment) => [segment.id, segment]));
  const next = new Map(after.segments.map((segment) => [segment.id, segment]));
  for (const segment of before.segments) if (!next.has(segment.id)) lines.push(`dropped ${segment.id}`);
  for (const segment of after.segments) if (!old.has(segment.id)) lines.push(`added ${segment.id} (${segment.clip} ${formatSpan(segment)}${segment.split === undefined ? "" : `, split screen ${segment.split.bands.map((band) => band.clip).join(", ")}`})`);
  const common = after.segments.filter((segment) => old.has(segment.id)).map((segment) => segment.id);
  const places = new Map(before.segments.filter((segment) => next.has(segment.id)).map((segment, index) => [segment.id, index]));
  const staying = findStayingIds(common, places);
  common.forEach((id, index) => {
    if (staying.has(id)) return;
    lines.push(index === 0 ? `moved ${id} to the start` : `moved ${id} after ${common[index - 1] ?? ""}`);
  });
  for (const id of common) {
    const a = old.get(id) as EdlSegment;
    const b = next.get(id) as EdlSegment;
    if (a.clip !== b.clip || a.start !== b.start || a.end !== b.end) lines.push(`${id}: ${a.clip} ${formatSpan(a)} → ${b.clip} ${formatSpan(b)}`);
    if (a.transition !== b.transition) lines.push(`${id}: ${a.transition} → ${b.transition}`);
    if (a.motion !== b.motion) lines.push(`${id}: motion ${a.motion} → ${b.motion}`);
    if (!isSameCamera(a.camera, b.camera)) lines.push(`${id}: camera ${describeCamera(a.camera)} → ${describeCamera(b.camera)}`);
    if (JSON.stringify(a.split) !== JSON.stringify(b.split)) lines.push(b.split === undefined ? `${id}: one shot again` : `${id}: split screen ${b.split.bands.map((band) => `${band.clip} "${band.label}"`).join(", ")}`);
    if (a.fadeFrames !== b.fadeFrames) lines.push(`${id}: fade ${a.fadeFrames === undefined ? "default" : `${String(a.fadeFrames)} frames`} → ${b.fadeFrames === undefined ? "default" : `${String(b.fadeFrames)} frames`}`);
  }
  for (const segment of after.segments) {
    const previous = old.get(segment.id);
    if (previous === undefined || isSameCaption(previous.caption, segment.caption)) continue;
    lines.push(isMovedCaption(segment.caption) ? `${segment.id} captions moved` : `${segment.id} captions back in the film's box`);
  }
  const [rangesBefore, rangesAfter] = [before.captionRanges ?? [], after.captionRanges ?? []];
  if (JSON.stringify(rangesBefore) !== JSON.stringify(rangesAfter)) {
    const spans = rangesAfter.map((range) => formatSpan({ start: range.from, end: range.to })).join(", ");
    lines.push(rangesAfter.length === 0 ? "captions back in the segments' boxes" : `captions moved in ${spans}`);
  }
  const [overlaysBefore, overlaysAfter] = [before.overlays ?? [], after.overlays ?? []];
  if (JSON.stringify(overlaysBefore) !== JSON.stringify(overlaysAfter)) {
    lines.push(`overlays: ${overlaysAfter.map((overlay) => overlay.kind.replace("_", " ")).join(", ") || "none"} (was ${overlaysBefore.length})`);
  }
  for (const segment of after.segments) {
    const was = old.get(segment.id)?.audio;
    const { audio } = segment;
    if (audio === undefined) {
      if (was !== undefined) lines.push(`${segment.id} plays its own sound again`);
      continue;
    }
    if (was !== undefined && was.clip === audio.clip && was.start === audio.start && was.end === audio.end && was.ownVolume === audio.ownVolume) continue;
    const speaker = findSpeaker(after, audio, segment.id) ?? findSpeaker(before, audio, segment.id);
    const source = speaker ?? `${audio.clip} ${formatSpan(audio)}`;
    lines.push(`${segment.id} over ${source}${audio.ownVolume > 0 ? ` (own sound at ${Math.round(audio.ownVolume * 100)} %)` : ""}`);
  }
  return lines;
}

/** Whether a segment's caption field moves its box (an empty object does not). */
function isMovedCaption(caption: EdlCaption | undefined): boolean {
  return caption?.bottom !== undefined || caption?.top !== undefined;
}

function isSameCaption(a: EdlCaption | undefined, b: EdlCaption | undefined): boolean {
  return a?.bottom === b?.bottom && a?.top === b?.top;
}

export function getEdlDuration(edl: Edl): number {
  return r3(edl.segments.reduce((sum, segment) => sum + (segment.end - segment.start), 0));
}

/**
 * The index of the segment that plays at `time` (film seconds): the one whose span holds it; a time before the film
 * gives the first segment, one at or past the cut's end the last.
 */
/** The caption range that holds film second `time` (from it, before its end), or undefined. */
export function findCaptionRangeAt(edl: Pick<Edl, "captionRanges">, time: number): EdlCaptionRange | undefined {
  return (edl.captionRanges ?? []).find((range) => range.from <= time && time < range.to);
}

export function findSegmentAt(edl: Edl, time: number): number {
  const starts = getSegmentStarts(edl);
  let found = 0;
  starts.forEach((start, index) => {
    if (start <= time) found = index;
  });
  return found;
}

/** Where each segment starts in the film, in seconds. */
export function getSegmentStarts(edl: Edl): number[] {
  const starts: number[] = [];
  let time = 0;
  for (const segment of edl.segments) {
    starts.push(r3(time));
    time += segment.end - segment.start;
  }
  return starts;
}

/**
 * The words the film says, in film time: the words of each segment's sound span (its own, or `audio`) that fall in it
 * (by their middle), shifted by where the segment lands; fillers left out. Every cut shifts every later word.
 */
export function remapWords(edl: Edl, words: Record<string, TimedWord[]>, fillers: readonly string[]): TimedWord[] {
  const starts = getSegmentStarts(edl);
  const film: TimedWord[] = [];
  edl.segments.forEach((segment, index) => {
    const sound = getSoundSpan(segment);
    const offset = (starts[index] as number) - sound.start;
    for (const word of words[sound.clip] ?? []) {
      const middle = (word.start + word.end) / 2;
      if (middle < sound.start || middle >= sound.end || isFiller(word.text, fillers)) continue;
      film.push({ text: word.text, start: r3(Math.max(word.start, sound.start) + offset), end: r3(Math.min(word.end, sound.end) + offset) });
    }
  });
  return film;
}

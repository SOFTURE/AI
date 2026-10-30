import { z } from "zod";

import type { TimedWord } from "../voice/voiceover.js";
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
  audio?: EdlAudio;
}

export interface Edl {
  version: 2;
  film: string;
  segments: EdlSegment[];
}

const SEGMENT_ID_PATTERN = /^[A-Za-z0-9._-]+$/;

const segmentFields = {
  clip: z.string().min(1).describe("The clip's id: the picture, and the sound unless audio says otherwise."),
  start: z.number().min(0).describe("Seconds in the trimmed clip where the segment starts."),
  end: z.number().positive().describe("Seconds in the trimmed clip where the segment ends."),
  transition: z.enum(CUT_TRANSITIONS).describe("How the segment starts: cut, fade (a cross-fade from the segment before), zoom (a punch-in) or whoosh."),
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
          audio: z
            .strictObject({
              clip: z.string().min(1).describe("The clip the sound comes from."),
              start: z.number().min(0).describe("Seconds in that trimmed clip where the sound starts."),
              end: z.number().positive().describe("Seconds in that trimmed clip where the sound ends; end - start equals the segment's length."),
              ownVolume: z.number().min(0).max(1).default(0).describe("The picture clip's own sound under it (0-1, default 0: muted)."),
            })
            .optional()
            .describe("Sound from another clip or span: a J- or L-cut, or b-roll over speech. Without it, the segment plays its own sound."),
        }),
      )
      .min(1, "the cut needs at least one segment")
      .describe("The kept parts of the clips, in film order."),
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
 * with `transitions.jump` inside one clip and `transitions.clip` between clips. Each segment's id names the sentence
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
      const transition = previous === undefined ? "cut" : previous.clip === clip.id ? transitions.jump : transitions.clip;
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

/**
 * What makes an EDL (a hand-edited one above all) unusable with these clips; empty when it is fine: another film,
 * an unknown clip, a span past a clip's end, a too short segment, a repeated id, a sound span of another length.
 */
export function validateEdl(edl: Edl, clips: Pick<EdlClip, "id" | "duration">[], filmId: string): string[] {
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
    const { audio } = segment;
    if (audio === undefined) return;
    checkSpan(`${at}.audio`, audio);
    const length = r3(segment.end - segment.start);
    const soundLength = r3(audio.end - audio.start);
    if (Math.abs(length - soundLength) > 0.05) problems.push(`${at}.audio: ${soundLength} s of sound for ${length} s of picture (end - start must match)`);
  });
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
  for (const segment of after.segments) if (!old.has(segment.id)) lines.push(`added ${segment.id} (${segment.clip} ${formatSpan(segment)})`);
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

export function getEdlDuration(edl: Edl): number {
  return r3(edl.segments.reduce((sum, segment) => sum + (segment.end - segment.start), 0));
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

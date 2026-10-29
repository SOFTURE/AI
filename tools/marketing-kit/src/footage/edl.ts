import { z } from "zod";

import type { TimedWord } from "../voice/voiceover.js";
import { CUT_TRANSITIONS, type ClipRole, type CutOptions, type CutTransition, type FootageTransitions } from "./film.js";

/**
 * The edit decision list: which parts of which clips the film keeps, in order, and how each part starts. Built from
 * the transcript (`buildEdl`), written as plain JSON next to the build so a person or an agent can check or change it
 * before the render, and read back through `edlSchema`.
 */

export const SEGMENT_MOTIONS = ["none", "kenburns"] as const;

export type SegmentMotion = (typeof SEGMENT_MOTIONS)[number];

export interface EdlSegment {
  /** The clip's id. */
  clip: string;
  /** Seconds in the trimmed clip. */
  start: number;
  end: number;
  transition: CutTransition;
  /** `kenburns`: a slow zoom over a segment without speech. */
  motion: SegmentMotion;
}

export interface Edl {
  version: 1;
  film: string;
  segments: EdlSegment[];
}

export const edlSchema = z.strictObject({
  version: z.literal(1),
  film: z.string().min(1),
  segments: z
    .array(
      z.strictObject({
        clip: z.string().min(1),
        start: z.number().min(0),
        end: z.number().positive(),
        transition: z.enum(CUT_TRANSITIONS),
        motion: z.enum(SEGMENT_MOTIONS),
      }),
    )
    .min(1, "the cut needs at least one segment"),
});

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

/** A word reduced for comparison: lower case, letters and digits only, repeated letters collapsed (`Yyyy,` → `y`). */
export function normalizeWord(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "")
    .replace(/(.)\1+/gu, "$1");
}

/** Whether the word is one of the fillers (compared as `normalizeWord` writes both). */
export function isFiller(text: string, fillers: readonly string[]): boolean {
  const word = normalizeWord(text);
  return word.length > 0 && fillers.some((filler) => normalizeWord(filler) === word);
}

interface Span {
  start: number;
  end: number;
}

/** The kept spans of a talking clip: runs of spoken words split at fillers and long pauses, padded, never into a neighbour word. */
function getTalkSpans(clip: EdlClip, options: CutOptions): Span[] {
  const runs: TimedWord[][] = [];
  let run: TimedWord[] = [];
  const words = [...clip.words].sort((a, b) => a.start - b.start);
  words.forEach((word, index) => {
    const previous = words[index - 1];
    if (isFiller(word.text, options.fillers)) {
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
    else spans.push({ start, end });
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

/**
 * The cut from the transcripts. A talking clip keeps its runs of words: fillers are cut out, a pause longer than
 * `pauseSeconds` is cut, `padSeconds` stays around each cut. A talking clip without words, and every b-roll clip, is
 * kept whole (b-roll with a slow zoom). The first segment starts with a cut; later ones with `transitions.jump`
 * inside one clip and `transitions.clip` between clips.
 */
export function buildEdl(filmId: string, clips: EdlClip[], options: CutOptions, transitions: FootageTransitions): Edl {
  const segments: EdlSegment[] = [];
  for (const clip of clips) {
    const spans = clip.role === "talk" ? getTalkSpans(clip, options) : [];
    const kept = spans.length > 0 ? spans : [{ start: 0, end: clip.duration }];
    for (const span of kept) {
      const previous = segments.at(-1);
      const transition = previous === undefined ? "cut" : previous.clip === clip.id ? transitions.jump : transitions.clip;
      segments.push({ clip: clip.id, start: r3(span.start), end: r3(span.end), transition, motion: clip.role === "broll" ? "kenburns" : "none" });
    }
  }
  return { version: 1, film: filmId, segments: limitLength(segments, options.maxSeconds) };
}

/** What makes an EDL (a hand-edited one above all) unusable with these clips; empty when it is fine. */
export function findEdlProblems(edl: Edl, clips: Pick<EdlClip, "id" | "duration">[], filmId: string): string[] {
  const problems: string[] = [];
  if (edl.film !== filmId) problems.push(`it belongs to film "${edl.film}", not "${filmId}"`);
  const durations = new Map(clips.map((clip) => [clip.id, clip.duration]));
  edl.segments.forEach((segment, index) => {
    const duration = durations.get(segment.clip);
    const at = `segments[${index}]`;
    if (duration === undefined) problems.push(`${at}.clip: no clip "${segment.clip}" in the film`);
    else if (segment.end > duration + 0.05) problems.push(`${at}.end: ${segment.end} s is past the clip's end (${duration.toFixed(2)} s)`);
    if (segment.end - segment.start < MIN_SEGMENT_SECONDS) problems.push(`${at}: shorter than ${MIN_SEGMENT_SECONDS} s (start ${segment.start}, end ${segment.end})`);
  });
  return problems;
}

/** Reads an EDL file's JSON; an error names the first problems by path. */
export function readEdl(json: unknown): { ok: true; edl: Edl } | { ok: false; error: string } {
  const parsed = edlSchema.safeParse(json);
  if (parsed.success) return { ok: true, edl: parsed.data };
  const issues = parsed.error.issues.slice(0, 5).map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`);
  return { ok: false, error: issues.join("; ") };
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
 * The words the film says, in film time: each clip's words that fall in a kept segment (by their middle), shifted by
 * where the segment lands; fillers left out. Every cut shifts every later word.
 */
export function remapWords(edl: Edl, words: Record<string, TimedWord[]>, fillers: readonly string[]): TimedWord[] {
  const starts = getSegmentStarts(edl);
  const film: TimedWord[] = [];
  edl.segments.forEach((segment, index) => {
    const offset = (starts[index] as number) - segment.start;
    for (const word of words[segment.clip] ?? []) {
      const middle = (word.start + word.end) / 2;
      if (middle < segment.start || middle >= segment.end || isFiller(word.text, fillers)) continue;
      film.push({ text: word.text, start: r3(Math.max(word.start, segment.start) + offset), end: r3(Math.min(word.end, segment.end) + offset) });
    }
  });
  return film;
}

// Output helpers: SRT and WebVTT subtitles and plain text with paragraph breaks, from a transcript's segments.
import type { TranscriptSegment } from "./contract.js";

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 3_600_000;
const DEFAULT_PARAGRAPH_GAP_SECONDS = 1.5;
const DEFAULT_PARAGRAPH_MAX_CHARS = 600;
const SENTENCE_END = /[.!?…]["')\]]*$/;

/** SubRip subtitles: numbered cues from 1, `HH:MM:SS,mmm` times. Segments without text are skipped. */
export function toSrt(segments: readonly TranscriptSegment[]): string {
  return getCues(segments)
    .map((cue, index) => `${String(index + 1)}\n${formatTime(cue.start, ",")} --> ${formatTime(cue.end, ",")}\n${cue.text}\n`)
    .join("\n");
}

/** WebVTT subtitles: the `WEBVTT` header, then one cue per segment with `HH:MM:SS.mmm` times. */
export function toVtt(segments: readonly TranscriptSegment[]): string {
  const cues = getCues(segments).map((cue) => `${formatTime(cue.start, ".")} --> ${formatTime(cue.end, ".")}\n${cue.text}\n`);
  return ["WEBVTT\n", ...cues].join("\n");
}

export interface ParagraphOptions {
  /** A pause of at least this many seconds between segments starts a new paragraph. Default 1.5. */
  readonly gapSeconds?: number;
  /** A paragraph this long ends at the next segment that closes a sentence. Default 600. */
  readonly maxChars?: number;
}

/** Plain text: segments joined with spaces, paragraphs separated by a blank line at pauses or after long runs. */
export function toParagraphs(segments: readonly TranscriptSegment[], options: ParagraphOptions = {}): string {
  const gapSeconds = options.gapSeconds ?? DEFAULT_PARAGRAPH_GAP_SECONDS;
  const maxChars = options.maxChars ?? DEFAULT_PARAGRAPH_MAX_CHARS;
  const paragraphs: string[][] = [];
  let current: string[] = [];
  let currentLength = 0;
  let previousEnd: number | null = null;

  for (const cue of getCues(segments)) {
    const isPause = previousEnd !== null && cue.start - previousEnd >= gapSeconds;
    if (isPause && current.length > 0) {
      paragraphs.push(current);
      current = [];
      currentLength = 0;
    }
    current.push(cue.text);
    currentLength += cue.text.length + 1;
    previousEnd = cue.end;
    if (currentLength >= maxChars && SENTENCE_END.test(cue.text)) {
      paragraphs.push(current);
      current = [];
      currentLength = 0;
    }
  }
  if (current.length > 0) paragraphs.push(current);
  return paragraphs.map((words) => words.join(" ")).join("\n\n");
}

/** The segments with trimmed, single-line text; empty ones dropped. */
function getCues(segments: readonly TranscriptSegment[]): TranscriptSegment[] {
  return segments
    .map((segment) => ({ ...segment, text: segment.text.replace(/\s+/g, " ").trim() }))
    .filter((segment) => segment.text !== "");
}

/** `HH:MM:SS<separator>mmm`, rounded to the millisecond; hours grow past 99 when they must. */
function formatTime(seconds: number, separator: "," | "."): string {
  const totalMs = Math.max(0, Math.round(seconds * MS_PER_SECOND));
  const hours = Math.floor(totalMs / MS_PER_HOUR);
  const minutes = Math.floor((totalMs % MS_PER_HOUR) / MS_PER_MINUTE);
  const wholeSeconds = Math.floor((totalMs % MS_PER_MINUTE) / MS_PER_SECOND);
  const ms = totalMs % MS_PER_SECOND;
  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(wholeSeconds, 2)}${separator}${pad(ms, 3)}`;
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, "0");
}

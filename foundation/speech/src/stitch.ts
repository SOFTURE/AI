// Stitching the transcripts of overlapping chunks back into one timeline.
import type { TranscriptSegment } from "./contract.js";

/** One chunk's transcript, with segments relative to the chunk's own start. */
export interface ChunkTranscript {
  /** Where the chunk starts and ends in the input, in seconds. */
  readonly start: number;
  readonly end: number;
  readonly text: string;
  readonly segments: readonly TranscriptSegment[];
}

/**
 * Shifts every chunk's segments by the chunk's start and cuts each overlap at its middle: a chunk keeps the segments
 * whose middle lies before the cut, the next chunk those at or after it. A segment cut by a chunk's edge is so taken
 * from the chunk that heard it whole. A chunk without segments contributes one segment spanning its own part.
 */
export function stitchChunks(chunks: readonly ChunkTranscript[]): TranscriptSegment[] {
  const stitched: TranscriptSegment[] = [];
  chunks.forEach((chunk, index) => {
    const previous = chunks[index - 1];
    const next = chunks[index + 1];
    const from = previous === undefined ? Number.NEGATIVE_INFINITY : getCut(previous, chunk);
    const to = next === undefined ? Number.POSITIVE_INFINITY : getCut(chunk, next);
    for (const segment of getSegments(chunk)) {
      const shifted = { start: segment.start + chunk.start, end: segment.end + chunk.start, text: segment.text.trim() };
      const middle = (shifted.start + shifted.end) / 2;
      if (middle >= from && middle < to && shifted.text !== "") stitched.push(shifted);
    }
  });
  return stitched;
}

/** The middle of the overlap of two neighbouring chunks (their boundary when they do not overlap). */
function getCut(earlier: ChunkTranscript, later: ChunkTranscript): number {
  return (later.start + Math.max(earlier.end, later.start)) / 2;
}

function getSegments(chunk: ChunkTranscript): readonly TranscriptSegment[] {
  if (chunk.segments.length > 0) return chunk.segments;
  return [{ start: 0, end: chunk.end - chunk.start, text: chunk.text }];
}

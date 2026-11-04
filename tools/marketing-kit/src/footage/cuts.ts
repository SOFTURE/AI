import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

import type { Edl } from "./edl.js";
import { DEFAULT_AUTO_THRESHOLD } from "./film.js";
import { FOOTAGE_FPS } from "./normalize.js";
import { runFfmpeg } from "./process.js";

/**
 * Transitions chosen from the frames around each jump cut (`transitions.jump: "auto"`): the last frame before a cut
 * and the first after it, both from the normalized clips, are shrunk to a small gray thumbnail and compared. A small
 * difference (the same framing, a removed filler) gets an eased punch-in (`zoom`), a large one (the camera moved) a
 * short dissolve (`fade`). Deterministic and local: ffmpeg only, no provider.
 */

/** The thumbnail both frames are compared at: small enough that handheld shake and noise average out. */
export const CUT_THUMBNAIL = { width: 48, height: 48 } as const;

/** What the frames around one cut measured and the transition it got. */
export interface CutMeasure {
  /** The id of the segment the cut starts. */
  segment: string;
  /** The mean absolute difference of the two thumbnails' gray levels, 0 (the same) to 1 (black against white). */
  difference: number;
  transition: "zoom" | "fade";
}

const r4 = (value: number): number => Math.round(value * 10000) / 10000 || 0;

/** The mean absolute difference of two gray frames of the same size, 0-1. */
export function measureFrameDifference(before: Uint8Array, after: Uint8Array): number {
  if (before.length === 0 || before.length !== after.length) {
    throw new Error(`Comparing the frames around a cut needs two frames of one size, got ${before.length} and ${after.length} bytes.`);
  }
  let sum = 0;
  for (let index = 0; index < before.length; index++) sum += Math.abs((before[index] as number) - (after[index] as number));
  return r4(sum / before.length / 255);
}

/** `fade` from `threshold` up (the picture moved), `zoom` below it (the same shot). */
export function chooseCutTransition(difference: number, threshold: number = DEFAULT_AUTO_THRESHOLD): "zoom" | "fade" {
  return difference >= threshold ? "fade" : "zoom";
}

/** One frame of a clip at `seconds` as a raw gray thumbnail (`CUT_THUMBNAIL`). */
export function buildCutFrameArgs(file: string, seconds: number, output: string): string[] {
  const { width, height } = CUT_THUMBNAIL;
  return ["-v", "error", "-y", "-ss", String(seconds), "-i", file, "-frames:v", "1", "-vf", `scale=${width}:${height}:flags=area,format=gray`, "-f", "rawvideo", output];
}

/** The indexes of the jump cuts the auto choice sets: a plain cut inside one clip, after the first segment. */
export function findAutoCuts(edl: Edl): number[] {
  return edl.segments.flatMap((segment, index) => {
    const previous = edl.segments[index - 1];
    return previous !== undefined && previous.clip === segment.clip && segment.transition === "cut" ? [index] : [];
  });
}

export interface ChooseCutTransitionsOptions {
  /** The difference from which a cut fades; default `DEFAULT_AUTO_THRESHOLD`. */
  threshold?: number;
  /** A folder for the thumbnails; created, and removed when done. */
  workDir: string;
  signal?: AbortSignal;
}

/**
 * Measures every plain jump cut of `edl` (`findAutoCuts`) on the normalized clips and gives it `zoom` or `fade`. Cuts
 * between clips and every other transition stay as they are. Answers the new EDL and what each cut measured.
 */
export async function chooseCutTransitions(edl: Edl, clips: Record<string, string>, options: ChooseCutTransitionsOptions): Promise<{ edl: Edl; cuts: CutMeasure[] }> {
  const threshold = options.threshold ?? DEFAULT_AUTO_THRESHOLD;
  if (!(threshold >= 0 && threshold <= 1)) throw new Error(`transitions.autoThreshold must be between 0 and 1, got ${String(threshold)}.`);
  const indexes = findAutoCuts(edl);
  if (indexes.length === 0) return { edl, cuts: [] };
  const signal = options.signal === undefined ? {} : { signal: options.signal };
  const getClip = (id: string): string => {
    const file = clips[id];
    if (file === undefined) throw new Error(`No file for clip "${id}" of the EDL.`);
    return file;
  };
  mkdirSync(options.workDir, { recursive: true });
  const segments = [...edl.segments];
  const cuts: CutMeasure[] = [];
  try {
    for (const index of indexes) {
      const segment = segments[index] as Edl["segments"][number];
      const previous = segments[index - 1] as Edl["segments"][number];
      const beforeFile = join(options.workDir, `${segment.id}-before.gray`);
      const afterFile = join(options.workDir, `${segment.id}-after.gray`);
      // The last frame the cut shows before it, and the first after it.
      const beforeAt = Math.round(Math.max(previous.start, previous.end - 1 / FOOTAGE_FPS) * 1000) / 1000;
      await runFfmpeg(`The frame before cut ${segment.id}`, buildCutFrameArgs(getClip(previous.clip), beforeAt, beforeFile), { ...signal, output: beforeFile });
      await runFfmpeg(`The frame after cut ${segment.id}`, buildCutFrameArgs(getClip(segment.clip), segment.start, afterFile), { ...signal, output: afterFile });
      const difference = measureFrameDifference(readFileSync(beforeFile), readFileSync(afterFile));
      const transition = chooseCutTransition(difference, threshold);
      segments[index] = { ...segment, transition };
      cuts.push({ segment: segment.id, difference, transition });
    }
  } finally {
    rmSync(options.workDir, { recursive: true, force: true });
  }
  return { edl: { ...edl, segments }, cuts };
}

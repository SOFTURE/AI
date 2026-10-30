import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { probeFile } from "./probe.js";
import { runFfmpeg } from "./process.js";

/**
 * Frames of a clip as JPG files (a contact sheet), so an agent can look at the footage and choose the opening shot or
 * the b-roll. Read from the normalized clip, so the frames are upright and in SDR as the film will show them.
 */

export type FrameSpacing = { count: number } | { everySeconds: number };

export interface ExtractFramesOptions {
  /** The folder the JPGs go to (`<name>-<n>.jpg`); created when missing. */
  outDir: string;
  /** The frames' width in px (the height keeps the aspect); 360 by default. */
  width?: number;
  /** The files' name before the number; `frame` by default. */
  name?: string;
  signal?: AbortSignal;
}

export interface ExtractedFrame {
  file: string;
  /** Seconds in the clip. */
  seconds: number;
}

const DEFAULT_WIDTH = 360;
/** The most frames one call writes, so a long clip with a short spacing stays a sheet, not a film. */
export const MAX_FRAMES = 120;

const r3 = (value: number): number => Math.round(value * 1000) / 1000 || 0;

/** The times to take frames at: `count` frames at the middles of equal parts, or one every `everySeconds` from its half. */
export function getFrameTimes(duration: number, spacing: FrameSpacing): number[] {
  if (duration <= 0) return [];
  const count = "count" in spacing ? spacing.count : Math.floor(duration / spacing.everySeconds);
  const step = "count" in spacing ? duration / spacing.count : spacing.everySeconds;
  const total = Math.min(MAX_FRAMES, Math.max(1, Math.floor(count)));
  return Array.from({ length: total }, (_, index) => r3(Math.min(duration - 0.01, (index + 0.5) * step)));
}

/** One frame at `seconds`, scaled to `width`. */
export function buildFrameArgs(file: string, seconds: number, width: number, output: string): string[] {
  return ["-v", "error", "-y", "-ss", String(seconds), "-i", file, "-frames:v", "1", "-vf", `scale=${width}:-2`, "-q:v", "3", output];
}

/** Writes the frames and answers their files and times; an error names the file. Rejects on abort. */
export async function extractFrames(file: string, spacing: FrameSpacing, options: ExtractFramesOptions): Promise<{ ok: true; frames: ExtractedFrame[] } | { ok: false; error: string }> {
  if ("count" in spacing ? !(spacing.count >= 1) : !(spacing.everySeconds > 0)) return { ok: false, error: "frames: count must be at least 1, everySeconds above 0" };
  const signal = options.signal === undefined ? {} : { signal: options.signal };
  const probed = await probeFile(file, signal);
  if (!probed.ok) return probed;
  mkdirSync(options.outDir, { recursive: true });
  const width = options.width ?? DEFAULT_WIDTH;
  const frames: ExtractedFrame[] = [];
  for (const [index, seconds] of getFrameTimes(probed.probe.duration, spacing).entries()) {
    const output = join(options.outDir, `${options.name ?? "frame"}-${String(index + 1).padStart(3, "0")}.jpg`);
    await runFfmpeg(`A frame of ${file} at ${seconds} s`, buildFrameArgs(file, seconds, width, output), { ...signal, output });
    frames.push({ file: output, seconds });
  }
  return { ok: true, frames };
}

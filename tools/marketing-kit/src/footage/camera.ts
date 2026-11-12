import { z } from "zod";

import { FOOTAGE_FPS } from "./normalize.js";

/**
 * A segment's camera: the framing it is shown at and a slow move over it, drawn alike by the draft (ffmpeg `zoompan`
 * about the anchor) and the render (a GSAP scale tween with the anchor as `transform-origin`). Captions and overlays
 * are drawn over the moved picture, so a move never moves them.
 *
 * - A still framing: `from` equal to `to` (1 is the full frame, 1.5 a tight crop).
 * - A push-in: `from` below `to`; a pull-out or a settle: `from` above `to`.
 * - `ease`: `linear` keeps one speed (a slow drift); `out` slows down to its end (`power1.out`, `1 - (1 - t)^2`).
 * - `seconds`: how long the move takes from the segment's start, then the picture holds; absent: the whole segment.
 * - `anchor`: the point of the frame the zoom keeps still (fractions of the frame; a face's centre keeps the face in
 *   the picture); absent: the kit's zoom origin (`CAMERA_ORIGIN`). The crop never leaves the source frame.
 */
export interface EdlCamera {
  from: number;
  to: number;
  ease: CameraEase;
  seconds?: number;
  anchor?: CameraAnchor;
}

export const CAMERA_EASES = ["linear", "out"] as const;

export type CameraEase = (typeof CAMERA_EASES)[number];

export interface CameraAnchor {
  x: number;
  y: number;
}

/** The point a zoom keeps still when it names none: the composition's `transform-origin: 50% 42%`. */
export const CAMERA_ORIGIN: CameraAnchor = { x: 0.5, y: 0.42 };

/** The tightest framing a camera may take: past it a 1080x1920 source shows its pixels. */
export const MAX_CAMERA_SCALE = 1.6;

const scaleSchema = z.number().min(1).max(MAX_CAMERA_SCALE);

export const cameraSchema = z
  .strictObject({
    from: scaleSchema.describe(`The scale the segment starts at: 1 is the full frame, up to ${String(MAX_CAMERA_SCALE)}.`),
    to: scaleSchema.describe("The scale it ends at; equal to from: a still framing."),
    ease: z.enum(CAMERA_EASES).describe("linear: one steady speed; out: slows down to its end."),
    seconds: z.number().positive().max(120).optional().describe("How long the move takes from the segment's start, then the picture holds; absent: the whole segment."),
    anchor: z
      .strictObject({
        x: z.number().min(0).max(1).describe("Across the frame, 0 (left) to 1 (right)."),
        y: z.number().min(0).max(1).describe("Down the frame, 0 (top) to 1 (bottom)."),
      })
      .optional()
      .describe("The point the zoom keeps still, such as the face's centre; absent: 50 % across, 42 % down."),
  })
  .describe("The segment's framing and a slow move over it (a push-in, a pull-out, a settle); drawn alike by the draft and the render.");

const r4 = (value: number): number => Math.round(value * 10000) / 10000 || 0;

/** The point a camera keeps still. */
export function getCameraOrigin(camera: Pick<EdlCamera, "anchor"> | undefined): CameraAnchor {
  return camera?.anchor ?? CAMERA_ORIGIN;
}

/** Whether a camera changes its scale over the segment (a still framing does not). */
export function isCameraMoving(camera: EdlCamera | undefined): boolean {
  return camera !== undefined && camera.from !== camera.to;
}

/** The frames a camera's move takes: its `seconds` (or the segment's length), at most the segment's frames, at least one. */
export function getCameraMoveFrames(camera: EdlCamera, segmentSeconds: number): number {
  const segmentFrames = Math.max(1, Math.round(segmentSeconds * FOOTAGE_FPS));
  return Math.max(1, Math.min(segmentFrames, Math.round((camera.seconds ?? segmentSeconds) * FOOTAGE_FPS)));
}

/** The camera's move in seconds, as the render's tween plays it (`getCameraMoveFrames` in film frames). */
export function getCameraMoveSeconds(camera: EdlCamera, segmentSeconds: number): number {
  return Math.round((getCameraMoveFrames(camera, segmentSeconds) / FOOTAGE_FPS) * 1000) / 1000;
}

/** The GSAP ease of a camera's move: `none` for `linear`, `power1.out` (`1 - (1 - t)^2`) for `out`. */
export function getCameraGsapEase(ease: CameraEase): string {
  return ease === "linear" ? "none" : "power1.out";
}

/** The camera's scale as an ffmpeg expression of the segment's frame number `variable`, as the render's tween eases it. */
export function getCameraScaleExpression(camera: EdlCamera, frames: number, variable = "on"): string {
  if (!isCameraMoving(camera)) return String(camera.from);
  const progress = `min(${variable}/${String(frames)},1)`;
  const eased = camera.ease === "linear" ? progress : `(1-pow(1-${progress},2))`;
  return `${String(camera.from)}+(${String(r4(camera.to - camera.from))})*${eased}`;
}

/** The camera's scale `frame` frames into its segment, as the draft's expression and the render's tween give it. */
export function getCameraScaleAt(camera: EdlCamera, frames: number, frame: number): number {
  const t = Math.min(Math.max(frame / frames, 0), 1);
  const eased = camera.ease === "linear" ? t : 1 - (1 - t) ** 2;
  return r4(camera.from + (camera.to - camera.from) * eased);
}

/** The anchor as a CSS `transform-origin`. */
export function toTransformOrigin(anchor: CameraAnchor): string {
  return `${String(r4(anchor.x * 100))}% ${String(r4(anchor.y * 100))}%`;
}

/** Whether a camera shows the full frame, still: drawn as no camera at all. */
function isFullFrame(camera: EdlCamera | undefined): boolean {
  return camera === undefined || (camera.from === 1 && camera.to === 1);
}

/**
 * Whether two cameras show the same framing: both the full frame, still (absent, or `from` and `to` 1), or the same
 * scales, ease, length and anchor.
 */
export function isSameCamera(a: EdlCamera | undefined, b: EdlCamera | undefined): boolean {
  if (isFullFrame(a) && isFullFrame(b)) return true;
  if (a === undefined || b === undefined) return false;
  const [pa, pb] = [getCameraOrigin(a), getCameraOrigin(b)];
  return a.from === b.from && a.to === b.to && a.ease === b.ease && a.seconds === b.seconds && pa.x === pb.x && pa.y === pb.y;
}

/** A camera in a few words, for `diffEdl` ("push 1 → 1.15 linear"). */
export function describeCamera(camera: EdlCamera | undefined): string {
  if (camera === undefined) return "none";
  const kind = camera.from === camera.to ? "framing" : camera.from < camera.to ? "push" : "pull";
  const scales = camera.from === camera.to ? String(camera.from) : `${String(camera.from)} → ${String(camera.to)} ${camera.ease}`;
  const anchor = camera.anchor === undefined ? "" : ` at ${String(r4(camera.anchor.x))},${String(r4(camera.anchor.y))}`;
  return `${kind} ${scales}${camera.seconds === undefined ? "" : ` over ${String(camera.seconds)} s`}${anchor}`;
}

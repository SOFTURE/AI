/** A `ResizeHandle`'s keyboard step for an arrow key, in pixels; Shift takes four of them. */
export const RESIZE_HANDLE_STEP = 16;

/**
 * `value` rounded and kept within `min` and `max`; a value that is not a finite number falls back to `fallback` (itself
 * kept within the limits). Plain module, so a Server Component can read a kept width with it (#1311).
 */
export function clampSize(value: number, min: number, max: number, fallback: number = min): number {
  if (!Number.isFinite(value)) return Math.min(Math.max(fallback, min), max);
  return Math.min(Math.max(Math.round(value), min), max);
}

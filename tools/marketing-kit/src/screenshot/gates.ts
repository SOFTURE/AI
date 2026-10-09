import type { Aspect } from "../config/shot-steps.js";

/**
 * The quality gates a screenshot passes before it is kept: the sign-in worked (signed-in entries), the page
 * answered below HTTP 400, its steps ran, it reached the requested scroll offset, it shows the expected phrase, a
 * crop found its one element and fits the page and the file has the frame's size, none of the entry's hidden
 * selectors still shows an element in the frame, the file is not suspiciously small, and no earlier file of the run
 * has the same bytes. A blank page, an error page, a half-loaded one, an
 * empty account or a frame of the wrong place fails at least one of them.
 */

export const SCREENSHOT_GATES = ["sign-in", "load", "status", "steps", "scroll", "phrase", "crop", "hide", "size", "duplicate"] as const;

export type ScreenshotGate = (typeof SCREENSHOT_GATES)[number];

/** The first status the gate refuses. */
export const MIN_FAILING_STATUS = 400;

/** Null when the status passes; otherwise why it does not. `null` status: the navigation had no response. */
export function findStatusFailure(status: number | null, url: string): string | null {
  if (status === null) return `no HTTP response from ${url}`;
  if (status >= MIN_FAILING_STATUS) return `HTTP ${status} from ${url}`;
  return null;
}

/** Browsers report fractional offsets on scaled screens; half a pixel short still counts as there. */
const SCROLL_TOLERANCE_PX = 1;

/** Null when the page scrolled to the offset; otherwise why the frame would show another place. */
export function findScrollFailure(reached: number, wanted: number): string | null {
  if (reached >= wanted - SCROLL_TOLERANCE_PX) return null;
  return `the page scrolls only to ${Math.round(reached)} px, short of scrollTo ${wanted}`;
}

/** Null when the file is large enough; otherwise why it is refused. */
export function findSizeFailure(bytes: number, minBytes: number): string | null {
  if (bytes >= minBytes) return null;
  return `the file has ${bytes} bytes, below minBytes ${minBytes} (a blank or broken page); deleted`;
}

/** A rectangle in CSS pixels, in document coordinates (from the page's top-left corner, not the viewport's). */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type CropFrameResult = { ok: true; frame: Rect } | { ok: false; message: string };

export interface CropFrameInput {
  /** The element, in document coordinates. */
  element: Rect;
  /** `crop.top`'s top edge in document coordinates: where the frame starts instead of the element's top edge. */
  top?: number;
  /** The page's scrollable size. */
  page: { width: number; height: number };
  aspect: Aspect;
  padding: number;
}

/**
 * The frame of a crop in whole CSS pixels: as wide as the element plus the padding on each side, from the padding
 * above its top edge (or above `top`), as tall as the aspect asks. Refused when `top` lies outside the element, whose
 * frame would then not show it, and when the frame would run past the page, which would leave part of the file empty
 * or cut it short.
 */
export function findCropFrame({ element, top, page, aspect, padding }: CropFrameInput): CropFrameResult {
  if (top !== undefined && top < element.y) return { ok: false, message: `crop.top's top edge lies ${Math.round(element.y - top)} px above crop.target` };
  if (top !== undefined && top >= element.y + element.height) {
    return { ok: false, message: `crop.top's top edge lies ${Math.round(top - element.y - element.height)} px below crop.target's bottom edge` };
  }
  const x = Math.floor(element.x - padding);
  const y = Math.floor((top ?? element.y) - padding);
  const width = Math.round(element.width + 2 * padding);
  const height = Math.round((width * aspect.height) / aspect.width);
  const ratio = `${aspect.width}:${aspect.height}`;
  if (width < 1) return { ok: false, message: `the crop's element has no width, so a ${ratio} frame has nothing to show` };
  if (x < 0) return { ok: false, message: `the ${ratio} frame starts ${-x} px left of the page; lower crop.padding` };
  if (y < 0) return { ok: false, message: `the ${ratio} frame starts ${-y} px above the page; lower crop.padding` };
  if (x + width > page.width) return { ok: false, message: `the ${ratio} frame runs ${x + width - page.width} px past the page's right edge; lower crop.padding` };
  if (y + height > page.height) {
    return { ok: false, message: `the ${ratio} frame (${width}×${height} px) runs ${y + height - page.height} px past the page's bottom edge` };
  }
  return { ok: true, frame: { x, y, width, height } };
}

/** Device pixels round once per side, so the file may be one pixel off the frame × scale. */
const DIMENSION_TOLERANCE_PX = 1;

/** Null when the PNG is the frame at the device scale; otherwise what it is instead. */
export function findDimensionFailure(file: { width: number; height: number }, frame: { width: number; height: number }, scale: number): string | null {
  const width = Math.round(frame.width * scale);
  const height = Math.round(frame.height * scale);
  const isWithin = Math.abs(file.width - width) <= DIMENSION_TOLERANCE_PX && Math.abs(file.height - height) <= DIMENSION_TOLERANCE_PX;
  if (isWithin) return null;
  return `the file is ${file.width}×${file.height} px, not the crop's ${width}×${height} px; deleted`;
}

/** Null when no hidden selector shows an element in the frame; otherwise the first that does, and how many. */
export function findHideFailure(counts: readonly { selector: string; shown: number | null }[]): string | null {
  for (const { selector, shown } of counts) {
    if (shown === null) return `hide "${selector}" is not a selector the browser can parse`;
    if (shown > 0) return `hide "${selector}" still shows ${shown} element${shown === 1 ? "" : "s"} in the frame`;
  }
  return null;
}

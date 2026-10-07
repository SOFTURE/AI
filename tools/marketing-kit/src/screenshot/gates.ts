/**
 * The quality gates a screenshot passes before it is kept (FIRE's screenshot script): the page
 * answered below HTTP 400, it reached the requested scroll offset, it shows the expected phrase, and
 * the file is not suspiciously small. A blank page, an error page, a half-loaded one or a frame of
 * the wrong place fails at least one of them.
 */

export const SCREENSHOT_GATES = ["load", "status", "scroll", "phrase", "size"] as const;

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

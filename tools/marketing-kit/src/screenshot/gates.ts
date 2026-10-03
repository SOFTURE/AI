/**
 * The quality gates a screenshot passes before it is kept (FIRE's screenshot script): the page
 * answered below HTTP 400, it shows the expected phrase, and the file is not suspiciously small. A
 * blank page, an error page or a half-loaded one fails at least one of them.
 */

export const SCREENSHOT_GATES = ["load", "status", "phrase", "size"] as const;

export type ScreenshotGate = (typeof SCREENSHOT_GATES)[number];

/** The first status the gate refuses. */
export const MIN_FAILING_STATUS = 400;

/** Null when the status passes; otherwise why it does not. `null` status: the navigation had no response. */
export function findStatusFailure(status: number | null, url: string): string | null {
  if (status === null) return `no HTTP response from ${url}`;
  if (status >= MIN_FAILING_STATUS) return `HTTP ${status} from ${url}`;
  return null;
}

/** Null when the file is large enough; otherwise why it is refused. */
export function findSizeFailure(bytes: number, minBytes: number): string | null {
  if (bytes >= minBytes) return null;
  return `the file has ${bytes} bytes, below minBytes ${minBytes} (a blank or broken page); deleted`;
}

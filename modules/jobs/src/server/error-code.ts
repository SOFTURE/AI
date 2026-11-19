// What `last_error` may hold: an error code (`app.provider_down`), never free text such as an exception's message,
// which can carry personal data and is shown to the job's owner and on the admin page.
import type { ErrorCode } from "@softure-ai/core";

const MAX_ERROR_LENGTH = 200;
/** Dotted segments of letters, digits, `_` and `-`: no spaces, `@`, `:` or `/`, so no sentence, address or URL. */
const ERROR_CODE_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*(\.[A-Za-z0-9_-]+)+$/;

/** The code to store for a returned error: its first 200 characters when it is a code, else `fallback`. */
export function toStoredErrorCode(error: string, fallback: ErrorCode): ErrorCode {
  const trimmed = error.slice(0, MAX_ERROR_LENGTH);
  return ERROR_CODE_PATTERN.test(trimmed) ? (trimmed as ErrorCode) : fallback;
}

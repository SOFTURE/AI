// A text page from a third-party site (an HTML page, a CSV export), with `requestBytes`' rules: a timeout that bounds
// the body too, the same status codes and `Retry-After` parsing, a size cap enforced while the body streams in, and no
// caught error's message read (it can quote the URL). Redirects are refused unless the caller opts in for a public page,
// so a credential header never reaches another host by accident. The answer names the final URL.
import { systemClock } from "./clock.js";
import { cancelBody, getMaxBytes, readCappedBody, type HttpBytesFailure } from "./http-bytes.js";
import { DEFAULT_TIMEOUT_MS, getStatusFailureCode, httpFailure, responseFailure, type RequestJsonOptions } from "./http-json.js";
import { ok, type Ok } from "./result.js";

/** A failed `requestText`: the same union as `requestBytes` (`core.http_*`, `core.http_too_large` included). */
export type HttpTextFailure = HttpBytesFailure;

export type HttpTextFailureCode = HttpTextFailure["error"];

/** The decoded body, the URL it came from (the final one after redirects), the status and the `Content-Type`. */
export interface HttpTextAnswer {
  readonly text: string;
  readonly url: string;
  readonly status: number;
  readonly contentType: string | null;
}

export interface RequestTextOptions extends RequestJsonOptions {
  /** Sent as `Accept`, replacing one in `headers`. Defaults to `headers`' own, else HTML first. */
  readonly accept?: string;
  /** The largest body accepted, in bytes (a positive integer). Defaults to 25 MiB (`DEFAULT_MAX_BYTES`). */
  readonly maxBytes?: number;
  /**
   * Follow redirects and answer the final URL. Off by default: a redirect is then `core.http_refused`, as in
   * `requestJson`. Turn it on for public pages only, since the headers go to wherever the redirect points.
   */
  readonly followRedirects?: boolean;
  /** Answer 404 and 410 as `ok(null)` instead of `core.http_unexpected_answer`. */
  readonly notFoundAsNull?: boolean;
}

const DEFAULT_ACCEPT = "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8";
const CHARSET_PATTERN = /;\s*charset\s*=\s*"?([^";\s]+)"?/i;

/**
 * GET `url` and read its body as text, decoded with the `charset` of `Content-Type` (UTF-8 when it has none or names
 * one this runtime cannot decode). Statuses fail as in `requestJson` (3xx, 401 and 403 refused, 409 and 412 a
 * conflict, 429 rate limited, 5xx unavailable, any other non-2xx an unexpected answer), except 404 and 410 with
 * `notFoundAsNull`. A `Content-Length` above `maxBytes`, or a body that grows past it, is `core.http_too_large`. Throws
 * for an invalid `maxBytes` before anything is sent.
 */
export function requestText(
  options: RequestTextOptions & { readonly notFoundAsNull: true },
): Promise<Ok<HttpTextAnswer | null> | HttpTextFailure>;
export function requestText(
  options: RequestTextOptions & { readonly notFoundAsNull?: false },
): Promise<Ok<HttpTextAnswer> | HttpTextFailure>;
export function requestText(options: RequestTextOptions): Promise<Ok<HttpTextAnswer | null> | HttpTextFailure>;
export async function requestText(options: RequestTextOptions): Promise<Ok<HttpTextAnswer | null> | HttpTextFailure> {
  const maxBytes = getMaxBytes("requestText", options.maxBytes);
  const fetchFunction = options.fetch ?? globalThis.fetch;

  let response: Response;
  try {
    // Inside the try: an invalid header value throws a message that quotes it.
    const headers = new Headers(options.headers);
    if (options.accept !== undefined) headers.set("accept", options.accept);
    else if (!headers.has("accept")) headers.set("accept", DEFAULT_ACCEPT);
    response = await fetchFunction(options.url, {
      method: "GET",
      headers,
      redirect: options.followRedirects === true ? "follow" : "manual",
      signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
  } catch {
    // Network error, timeout or a redirect loop. The error's text can quote the URL, so it is dropped on purpose.
    return httpFailure("core.http_unreachable", null);
  }

  if (options.notFoundAsNull === true && (response.status === 404 || response.status === 410)) {
    await cancelBody(response);
    return ok(null);
  }
  const statusFailureCode = getStatusFailureCode(response);
  if (statusFailureCode !== null) {
    await cancelBody(response);
    return responseFailure(statusFailureCode, response, options.clock ?? systemClock);
  }
  const bytes = await readCappedBody(response, maxBytes);
  if (!bytes.ok) return bytes;
  const contentType = response.headers.get("content-type");
  return ok({
    text: decodeText(bytes.value, contentType),
    // A constructed `Response` (a test's fake) has no URL; the requested one is then the final one.
    url: response.url === "" ? String(options.url) : response.url,
    status: response.status,
    contentType,
  });
}

function decodeText(bytes: Uint8Array, contentType: string | null): string {
  const charset = CHARSET_PATTERN.exec(contentType ?? "")?.[1];
  let decoder: TextDecoder;
  try {
    decoder = new TextDecoder(charset ?? "utf-8");
  } catch {
    // An unknown charset label: UTF-8 is what the web mostly sends.
    decoder = new TextDecoder("utf-8");
  }
  return decoder.decode(bytes);
}

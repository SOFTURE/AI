// A binary download from a third-party API (a PDF, an image, an export), with `requestJson`'s rules: a timeout that
// bounds the body too, no redirect followed, the same status codes, and no caught error's message read (it can quote
// the URL). The body is read chunk by chunk under a size cap, so a runaway answer is refused instead of buffered. The
// exported helpers below `requestBytes` are shared with `requestText` (http-text.ts) and are not part of the package's API.
import { systemClock } from "./clock.js";
import {
  DEFAULT_TIMEOUT_MS,
  getRequestBody,
  getStatusFailureCode,
  httpFailure,
  responseFailure,
  type HttpJsonFailure,
  type HttpJsonMethod,
  type RequestJsonOptions,
} from "./http-json.js";
import { err, ok, type Err, type Ok } from "./result.js";

/** A failed `requestBytes`: a `requestJson` failure, or a body larger than `maxBytes` (`core.http_too_large`). */
export type HttpBytesFailure = HttpJsonFailure | (Err<"core.http_too_large"> & { readonly status: number });

export type HttpBytesFailureCode = HttpBytesFailure["error"];

/** The downloaded body and the answer's `Content-Type` (`null` when it has none). */
export interface HttpBytesAnswer {
  readonly bytes: Uint8Array;
  readonly contentType: string | null;
}

interface RequestBytesBaseOptions extends RequestJsonOptions {
  /** Sent as `Accept`, replacing one in `headers`. Defaults to `headers`' own, else `*\/*`. */
  readonly accept?: string;
  /** The largest body accepted, in bytes (a positive integer). Defaults to 25 MiB. */
  readonly maxBytes?: number;
}

/** A GET: no body, no idempotency key. */
export interface RequestBytesReadOptions extends RequestBytesBaseOptions {
  readonly method?: "GET";
  readonly body?: never;
  readonly idempotencyKey?: never;
}

/** A write whose answer is a file, e.g. a POST that renders a PDF. */
export interface RequestBytesWriteOptions extends RequestBytesBaseOptions {
  readonly method: Exclude<HttpJsonMethod, "GET">;
  /** Serialised with `JSON.stringify`; `undefined` sends no body. A binary body or a form throws. */
  readonly body?: unknown;
  /** Sent as `Idempotency-Key`. */
  readonly idempotencyKey?: string;
}

export type RequestBytesOptions = RequestBytesReadOptions | RequestBytesWriteOptions;

export const DEFAULT_MAX_BYTES = 25 * 1024 * 1024;

/**
 * Call `url` (a GET unless `method` says otherwise) and read its body as bytes. Statuses fail as in `requestJson`
 * (3xx, 401 and 403 refused, 409 and 412 a conflict, 429 rate limited, 5xx unavailable, any other non-2xx an
 * unexpected answer). A `Content-Length` above `maxBytes`, or a body that grows past it, is `core.http_too_large`
 * and the rest is not read. Throws for a misuse (an invalid `maxBytes`, a GET with a body) before anything is sent.
 */
export async function requestBytes(options: RequestBytesOptions): Promise<Ok<HttpBytesAnswer> | HttpBytesFailure> {
  const maxBytes = getMaxBytes("requestBytes", options.maxBytes);
  const method = options.method ?? "GET";
  // Read as unknown: a JavaScript caller can pass what the types rule out.
  const requestBody: unknown = options.body;
  if (method === "GET" && requestBody !== undefined) throw new TypeError("requestBytes: a GET carries no body");
  const { body, contentType } = getRequestBody(method === "GET" ? { method } : { method, body: requestBody });
  const fetchFunction = options.fetch ?? globalThis.fetch;

  let response: Response;
  try {
    // Inside the try: an invalid header value throws a message that quotes it.
    const headers = new Headers(options.headers);
    if (options.accept !== undefined) headers.set("accept", options.accept);
    else if (!headers.has("accept")) headers.set("accept", "*/*");
    if (contentType !== undefined && contentType !== null && !headers.has("content-type")) headers.set("content-type", contentType);
    if (options.idempotencyKey !== undefined) headers.set("idempotency-key", options.idempotencyKey);
    response = await fetchFunction(options.url, {
      method,
      headers,
      body,
      redirect: "manual",
      signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
  } catch {
    // Network error or timeout. The error's text can quote the URL, so it is dropped on purpose.
    return httpFailure("core.http_unreachable", null);
  }

  const statusFailureCode = getStatusFailureCode(response);
  if (statusFailureCode !== null) {
    await cancelBody(response);
    return responseFailure(statusFailureCode, response, options.clock ?? systemClock);
  }
  const bytes = await readCappedBody(response, maxBytes);
  if (!bytes.ok) return bytes;
  return ok({ bytes: bytes.value, contentType: response.headers.get("content-type") });
}

/** `maxBytes` or the default; throws for a value that is not a positive integer, before anything is sent. */
export function getMaxBytes(caller: string, maxBytes: number | undefined): number {
  const value = maxBytes ?? DEFAULT_MAX_BYTES;
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${caller}: maxBytes must be a positive integer, got ${String(value)}`);
  }
  return value;
}

/**
 * The body of a successful answer, read chunk by chunk. A `Content-Length` above `maxBytes`, or a body that grows past
 * it, is `core.http_too_large` and the rest is cancelled unread; a body that breaks off is `core.http_unreachable`.
 */
export async function readCappedBody(response: Response, maxBytes: number): Promise<Ok<Uint8Array> | HttpBytesFailure> {
  const tooLarge = { ...err("core.http_too_large"), status: response.status } as const;
  if (Number(response.headers.get("content-length") ?? 0) > maxBytes) {
    await cancelBody(response);
    return tooLarge;
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = response.body?.getReader();
  try {
    for (let read = await reader?.read(); read !== undefined && !read.done; read = await reader?.read()) {
      total += read.value.byteLength;
      if (total > maxBytes) {
        await reader?.cancel().catch(() => undefined);
        return tooLarge;
      }
      chunks.push(read.value);
    }
  } catch {
    // The body broke off, usually the timeout firing mid-body.
    return httpFailure("core.http_unreachable", response.status);
  }
  return ok(concatChunks(chunks, total));
}

/** Releases the connection; a body that cannot be cancelled changes nothing for the caller. */
export async function cancelBody(response: Response): Promise<void> {
  await response.body?.cancel().catch(() => undefined);
}

function concatChunks(chunks: readonly Uint8Array[], total: number): Uint8Array {
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

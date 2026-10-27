// A JSON call to a third-party API (a GET, or a write with a JSON or form body), with the details every app's own copy
// has to get right: a timeout, no redirect followed (a key in a header or the URL never reaches another host), and every
// failure returned as a code. A caught error's message is never read, since it can quote the URL and some APIs put
// the key there. The body stays `unknown` unless a zod schema narrows it. Response headers are read only by name from
// the caller's allow-list, and an error answer's body only through the caller's `errorSchema`, so nothing secret is
// surfaced by accident. The exported helpers below `requestJson` are shared with `requestBytes` (http-bytes.ts) and
// are not part of the package's API.
import type { z } from "zod";
import { systemClock, type Clock } from "./clock.js";
import { err, ok, type Err, type Ok } from "./result.js";

export type HttpJsonFailureCode =
  | "core.http_unreachable"
  | "core.http_refused"
  | "core.http_rate_limited"
  | "core.http_unavailable"
  | "core.http_conflict"
  | "core.http_unexpected_answer";

/** The failure codes whose answer may say when to try again (`Retry-After`). */
export type HttpJsonRetryableCode = "core.http_rate_limited" | "core.http_unavailable";

/** The headers named in `readHeaders`, keyed as the caller wrote them; `null` when the answer does not carry one. */
export type HttpJsonResponseHeaders<H extends string = string> = Readonly<Record<H, string | null>>;

/**
 * A failed `requestJson`: the code and the HTTP status (`null` when no response arrived). A rate limited or
 * unavailable answer adds `retryAfterSeconds`, and a response read with `readHeaders` adds `headers`. Nothing else.
 */
export type HttpJsonFailure =
  | (Err<Exclude<HttpJsonFailureCode, HttpJsonRetryableCode>> & {
      readonly status: number | null;
      readonly headers?: HttpJsonResponseHeaders;
    })
  | (Err<HttpJsonRetryableCode> & {
      readonly status: number;
      /** Parsed from `Retry-After` (seconds or an HTTP date), 0 to 86 400; `null` when missing or malformed. */
      readonly retryAfterSeconds: number | null;
      readonly headers?: HttpJsonResponseHeaders;
    });

/**
 * A failed `requestJson` made with `errorSchema`: `errorBody` is the schema's output when the answer was a 4xx, 429 or
 * 5xx whose body is JSON that passes it, and `null` otherwise (an empty or invalid body, a redirect, no response, a
 * body that broke off, a 2xx that failed `schema`).
 */
export type HttpJsonErrorBodyFailure<B> = HttpJsonFailure & { readonly errorBody: B | null };

/** The failure of a call whose `errorSchema` is `E`: `HttpJsonFailure` when the call passed none. */
export type HttpJsonFailureFor<E extends z.ZodType | undefined> = E extends z.ZodType
  ? HttpJsonErrorBodyFailure<z.output<E>>
  : HttpJsonFailure;

/** The value of a call made with `readHeaders`: the body as without it, and the requested headers. */
export type HttpJsonAnswer<T, H extends string> = { readonly body: T; readonly headers: HttpJsonResponseHeaders<H> };

export type HttpJsonWriteMethod = "POST" | "PUT" | "PATCH" | "DELETE";
export type HttpJsonMethod = "GET" | HttpJsonWriteMethod;

export type FetchFunction = (input: string | URL, init: RequestInit) => Promise<Response>;

export interface RequestJsonOptions {
  readonly url: string | URL;
  /** Defaults to the global `fetch`; tests pass a fake. */
  readonly fetch?: FetchFunction;
  readonly headers?: HeadersInit;
  /** Milliseconds before the request (body included) gives up. Defaults to 10 000. */
  readonly timeoutMs?: number;
  /** Measures a `Retry-After` HTTP date. Defaults to `systemClock`. */
  readonly clock?: Clock;
}

/** Response headers to return, by name (any letter case). Only these are read. */
export interface RequestJsonReadHeadersOptions<H extends string> {
  readonly readHeaders: readonly H[];
}

/**
 * Reads the body of a 4xx, 429 or 5xx answer through this schema into the failure's `errorBody`. Without it the body
 * is cancelled unread. The schema's issues never leave, only its output.
 */
export interface RequestJsonErrorSchemaOptions<E extends z.ZodType | undefined> {
  readonly errorSchema?: E;
}

/** The calls without `readHeaders`, whose value is the body itself. */
interface WithoutReadHeaders {
  readonly readHeaders?: undefined;
}

export interface RequestJsonSchemaOptions<S extends z.ZodType> extends RequestJsonOptions {
  readonly schema: S;
}

/** A GET: no body, no idempotency key (a GET is idempotent already). */
export interface RequestJsonReadOptions extends RequestJsonOptions {
  readonly method?: "GET";
  readonly body?: never;
  readonly form?: never;
  readonly idempotencyKey?: never;
}

interface RequestJsonWriteBaseOptions extends RequestJsonOptions {
  readonly method: HttpJsonWriteMethod;
  /** Sent as `Idempotency-Key`, for providers that deduplicate retried writes by it. */
  readonly idempotencyKey?: string;
}

/** A write with a JSON body (or none). */
export interface RequestJsonJsonWriteOptions extends RequestJsonWriteBaseOptions {
  /**
   * Serialised with `JSON.stringify`; `undefined` sends no body. A value JSON cannot represent throws, and so does a
   * `FormData`, `URLSearchParams`, `Blob`, binary buffer or stream (send a form with `form`).
   */
  readonly body?: unknown;
  readonly form?: undefined;
}

/** A write with a form body; the answer is still read as JSON. */
export interface RequestJsonFormWriteOptions extends RequestJsonWriteBaseOptions {
  /**
   * `URLSearchParams` is sent as `application/x-www-form-urlencoded` (a `Content-Type` in `headers` wins). `FormData`
   * is sent as `multipart/form-data` with the boundary `fetch` adds; a `Content-Type` in `headers` is dropped, since
   * it could not carry the boundary.
   */
  readonly form: URLSearchParams | FormData;
  readonly body?: undefined;
}

/** A write: the body is sent as JSON or as a form, and an answer with no body is `ok(undefined)`. */
export type RequestJsonWriteOptions = RequestJsonJsonWriteOptions | RequestJsonFormWriteOptions;

export const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_RETRY_AFTER_SECONDS = 86_400;
// An RFC 9110 token: what a header name may be made of.
const HEADER_NAME_PATTERN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

/**
 * Call `url` (a GET unless `method` says otherwise) and read its JSON body. Without a schema the value is `unknown`,
 * for the caller to narrow; with one it is the schema's output. A write answered with an empty body (a 204) is
 * `ok(undefined)`, schema or not. 3xx, 401 and 403 are refused, 409 and 412 a conflict, 429 rate limited, 5xx
 * unavailable, and any other non-2xx status or a body that is not JSON or fails the schema an unexpected answer.
 * With `readHeaders` the value is `{ body, headers }`, and a failure that had a response carries `headers` too.
 * With `errorSchema` every failure carries `errorBody` (see `HttpJsonErrorBodyFailure`).
 */
export function requestJson<S extends z.ZodType, const H extends string, E extends z.ZodType | undefined = undefined>(
  options: RequestJsonSchemaOptions<S> &
    RequestJsonReadOptions &
    RequestJsonReadHeadersOptions<H> &
    RequestJsonErrorSchemaOptions<E>,
): Promise<Ok<HttpJsonAnswer<z.output<S>, H>> | HttpJsonFailureFor<E>>;
export function requestJson<S extends z.ZodType, const H extends string, E extends z.ZodType | undefined = undefined>(
  options: RequestJsonSchemaOptions<S> &
    RequestJsonWriteOptions &
    RequestJsonReadHeadersOptions<H> &
    RequestJsonErrorSchemaOptions<E>,
): Promise<Ok<HttpJsonAnswer<z.output<S> | undefined, H>> | HttpJsonFailureFor<E>>;
export function requestJson<const H extends string, E extends z.ZodType | undefined = undefined>(
  options: (RequestJsonReadOptions | RequestJsonWriteOptions) &
    RequestJsonReadHeadersOptions<H> &
    RequestJsonErrorSchemaOptions<E>,
): Promise<Ok<HttpJsonAnswer<unknown, H>> | HttpJsonFailureFor<E>>;
export function requestJson<S extends z.ZodType, E extends z.ZodType | undefined = undefined>(
  options: RequestJsonSchemaOptions<S> & RequestJsonReadOptions & WithoutReadHeaders & RequestJsonErrorSchemaOptions<E>,
): Promise<Ok<z.output<S>> | HttpJsonFailureFor<E>>;
export function requestJson<S extends z.ZodType, E extends z.ZodType | undefined = undefined>(
  options: RequestJsonSchemaOptions<S> & RequestJsonWriteOptions & WithoutReadHeaders & RequestJsonErrorSchemaOptions<E>,
): Promise<Ok<z.output<S> | undefined> | HttpJsonFailureFor<E>>;
export function requestJson<E extends z.ZodType | undefined = undefined>(
  options: (RequestJsonReadOptions | RequestJsonWriteOptions) & WithoutReadHeaders & RequestJsonErrorSchemaOptions<E>,
): Promise<Ok<unknown> | HttpJsonFailureFor<E>>;
export async function requestJson(
  options: (RequestJsonReadOptions | RequestJsonWriteOptions) & {
    readonly schema?: z.ZodType;
    readonly readHeaders?: readonly string[];
    readonly errorSchema?: z.ZodType;
  },
): Promise<Ok<unknown> | HttpJsonFailure> {
  // Before anything is sent: a write must not go out when its answer cannot be read.
  assertHeaderNames(options.readHeaders);
  const fetchFunction = options.fetch ?? globalThis.fetch;
  const method = options.method ?? "GET";
  const isWrite = method !== "GET";
  // Outside the try on purpose: a body that cannot be sent is the caller's bug, not an unreachable service.
  const { body, contentType } = getRequestBody(options);

  let response: Response;
  try {
    // Inside the try: an invalid header value throws a message that quotes it.
    const headers = new Headers(options.headers);
    if (!headers.has("accept")) {
      headers.set("accept", "application/json");
    }
    if (contentType === null) {
      // A multipart body: `fetch` sets the type with the boundary, and a hand-set one would make it unreadable.
      headers.delete("content-type");
    } else if (contentType !== undefined && !headers.has("content-type")) {
      headers.set("content-type", contentType);
    }
    if (options.idempotencyKey !== undefined) {
      headers.set("idempotency-key", options.idempotencyKey);
    }
    response = await fetchFunction(options.url, {
      method,
      headers,
      body,
      redirect: "manual",
      signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
  } catch {
    // Network error or timeout. The error's text can quote the URL, so it is dropped on purpose.
    return withErrorBody(httpFailure("core.http_unreachable", null), options.errorSchema, null);
  }

  const headers = options.readHeaders === undefined ? undefined : readResponseHeaders(response, options.readHeaders);
  const fail = (code: HttpJsonFailureCode, errorBody: unknown = null): HttpJsonFailure =>
    withErrorBody(
      withHeaders(responseFailure(code, response, options.clock ?? systemClock), headers),
      options.errorSchema,
      errorBody,
    );
  const succeed = (body: unknown): Ok<unknown> => ok(headers === undefined ? body : { body, headers });

  const statusFailureCode = getStatusFailureCode(response);
  if (statusFailureCode !== null) {
    if (options.errorSchema !== undefined && !isRedirect(response)) {
      // The read runs under the request's signal, so the timeout bounds it.
      return fail(statusFailureCode, await readErrorBody(response, options.errorSchema));
    }
    // Release the connection; a body that cannot be cancelled changes nothing for the caller.
    await response.body?.cancel().catch(() => undefined);
    return fail(statusFailureCode);
  }

  let text: string;
  try {
    text = await response.text();
  } catch {
    // The body broke off, usually the timeout firing mid-body.
    return fail("core.http_unreachable");
  }

  if (isWrite && text.trim() === "") {
    // A 204, or a write that answers 200 with nothing: the write succeeded and there is nothing to read.
    return succeed(undefined);
  }

  let answer: unknown;
  try {
    answer = JSON.parse(text);
  } catch {
    return fail("core.http_unexpected_answer");
  }

  if (options.schema === undefined) {
    return succeed(answer);
  }
  // The schema's issues can quote the body's values, so only the code leaves.
  const parsed = options.schema.safeParse(answer);
  return parsed.success ? succeed(parsed.data) : fail("core.http_unexpected_answer");
}

/** The URLs of the pagination relations in a `Link` header (RFC 8288), as written; missing ones are left out. */
export interface LinkHeaderLinks {
  readonly next?: string;
  readonly prev?: string;
  readonly first?: string;
  readonly last?: string;
}

type LinkRelation = keyof LinkHeaderLinks;

const REL_PATTERN = /(?:^|;)\s*rel\s*=\s*(?:"([^"]*)"|([^\s;,"]+))/i;
const LINK_RELATIONS: Readonly<Record<string, LinkRelation>> = {
  next: "next",
  prev: "prev",
  previous: "prev",
  first: "first",
  last: "last",
};

/**
 * Read `next`, `prev` (or `previous`), `first` and `last` from a `Link` header such as
 * `<https://api.example.com/items?page=2>; rel="next"`. The first link of a relation wins; `null`, an empty value or
 * one that cannot be read gives `{}`.
 */
export function parseLinkHeader(value: string | null | undefined): LinkHeaderLinks {
  const links: Partial<Record<LinkRelation, string>> = {};
  if (value === null || value === undefined) {
    return links;
  }
  // One link: the URL in angle brackets and its parameters up to the next `<`. Splitting by commas would break a URL
  // that contains one, and a regular expression would rescan the rest of a hostile value from every `<`.
  let position = 0;
  while (position < value.length) {
    const open = value.indexOf("<", position);
    const close = open === -1 ? -1 : value.indexOf(">", open + 1);
    if (close === -1) {
      break;
    }
    const nextOpen = value.indexOf("<", close + 1);
    position = nextOpen === -1 ? value.length : nextOpen;
    const url = value.slice(open + 1, close).trim();
    const rel = REL_PATTERN.exec(value.slice(close + 1, position));
    const relationTypes = rel?.[1] ?? rel?.[2];
    if (url === "" || relationTypes === undefined) {
      continue;
    }
    for (const relationType of relationTypes.trim().toLowerCase().split(/\s+/)) {
      const relation = LINK_RELATIONS[relationType];
      if (relation !== undefined && links[relation] === undefined) {
        links[relation] = url;
      }
    }
  }
  return links;
}

/**
 * The query part of a URL (without `?`) from a flat record, in insertion order. `null` and `undefined` are left
 * out, so optional parameters can be passed as they are.
 */
export function toQueryString(params: Readonly<Record<string, string | number | boolean | null | undefined>>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined) {
      search.append(key, String(value));
    }
  }
  return search.toString();
}

/**
 * The body to send and the content type to set unless `headers` has one (`null`: remove any, `fetch` sets it).
 * Throws for a misuse, before anything is sent.
 */
export function getRequestBody(options: { readonly method?: HttpJsonMethod; readonly body?: unknown; readonly form?: unknown }): {
  readonly body: string | URLSearchParams | FormData | undefined;
  readonly contentType: string | null | undefined;
} {
  // Read as unknown: a JavaScript caller can pass what the types rule out.
  const form: unknown = options.form;
  if (form !== undefined) {
    if (options.body !== undefined) throw new TypeError("requestJson: pass either body or form, not both");
    if ((options.method ?? "GET") === "GET") throw new TypeError("requestJson: a GET carries no form");
    if (form instanceof URLSearchParams) return { body: form, contentType: "application/x-www-form-urlencoded" };
    if (form instanceof FormData) return { body: form, contentType: null };
    throw new TypeError("requestJson: form must be a URLSearchParams or a FormData");
  }
  if (options.body === undefined) return { body: undefined, contentType: undefined };
  const kind = getNonJsonBodyKind(options.body);
  if (kind !== null) {
    // JSON.stringify would send `{}` (or a buffer's indices) and the provider would get nothing it can read.
    throw new TypeError(`requestJson: body is ${kind}, which JSON cannot carry; use \`form\` for a form or a file upload`);
  }
  return { body: JSON.stringify(options.body), contentType: "application/json" };
}

function getNonJsonBodyKind(body: unknown): string | null {
  if (body instanceof FormData) return "a FormData";
  if (body instanceof URLSearchParams) return "a URLSearchParams";
  if (body instanceof Blob) return "a Blob";
  if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) return "a binary buffer";
  if (body instanceof ReadableStream) return "a stream";
  return null;
}

export function isRedirect(response: Response): boolean {
  return response.type === "opaqueredirect" || (response.status >= 300 && response.status < 400);
}

/**
 * The error answer's body through `errorSchema`, or `null` when it breaks off (the timeout included), is empty, is
 * not JSON or fails the schema. Neither the text nor the schema's issues leave.
 */
async function readErrorBody(response: Response, errorSchema: z.ZodType): Promise<unknown> {
  let text: string;
  try {
    text = await response.text();
  } catch {
    return null;
  }
  let answer: unknown;
  try {
    answer = JSON.parse(text);
  } catch {
    return null;
  }
  const parsed = errorSchema.safeParse(answer);
  return parsed.success ? parsed.data : null;
}

export function getStatusFailureCode(response: Response): HttpJsonFailureCode | null {
  const { status } = response;
  if (isRedirect(response) || status === 401 || status === 403) {
    return "core.http_refused";
  }
  if (status === 409 || status === 412) {
    return "core.http_conflict";
  }
  if (status === 429) {
    return "core.http_rate_limited";
  }
  if (status >= 500) {
    return "core.http_unavailable";
  }
  if (status < 200 || status >= 300) {
    return "core.http_unexpected_answer";
  }
  return null;
}

export function httpFailure(code: Exclude<HttpJsonFailureCode, HttpJsonRetryableCode>, status: number | null): HttpJsonFailure {
  return { ...err(code), status };
}

export function responseFailure(code: HttpJsonFailureCode, response: Response, clock: Clock): HttpJsonFailure {
  if (code === "core.http_rate_limited" || code === "core.http_unavailable") {
    const retryAfterSeconds = getRetryAfterSeconds(response.headers.get("retry-after"), clock.now());
    return { ...err(code), status: response.status, retryAfterSeconds };
  }
  return httpFailure(code, response.status);
}

function withHeaders(failure: HttpJsonFailure, headers: HttpJsonResponseHeaders | undefined): HttpJsonFailure {
  return headers === undefined ? failure : { ...failure, headers };
}

/** Adds `errorBody` only to the calls made with `errorSchema`, so the others keep their shape. */
function withErrorBody(failure: HttpJsonFailure, errorSchema: z.ZodType | undefined, errorBody: unknown): HttpJsonFailure {
  if (errorSchema === undefined) return failure;
  const withBody: HttpJsonErrorBodyFailure<unknown> = { ...failure, errorBody };
  return withBody;
}

function assertHeaderNames(names: readonly string[] | undefined): void {
  for (const name of names ?? []) {
    if (!HEADER_NAME_PATTERN.test(name)) {
      throw new RangeError(`requestJson: readHeaders holds an invalid header name ${JSON.stringify(name)}`);
    }
  }
}

function readResponseHeaders(response: Response, names: readonly string[]): HttpJsonResponseHeaders {
  return Object.fromEntries(names.map((name) => [name, response.headers.get(name)]));
}

/**
 * Seconds to wait from a `Retry-After` value (RFC 9110): delay-seconds, or an HTTP date measured against `now` and
 * rounded up. A date in the past is 0, anything above a day is a day, and a malformed value is `null`.
 */
function getRetryAfterSeconds(value: string | null, now: Date): number | null {
  const trimmed = value?.trim() ?? "";
  if (/^\d+$/.test(trimmed)) {
    return Math.min(Number(trimmed), MAX_RETRY_AFTER_SECONDS);
  }
  // Every HTTP date names its day and month; without a letter the value is no date (and `Date.parse` guesses).
  if (!/^[A-Za-z]/.test(trimmed)) {
    return null;
  }
  // HTTP dates are GMT; the obsolete asctime form says so nowhere, and `Date.parse` would read it as local time.
  const at = Date.parse(/(GMT|UTC)$/i.test(trimmed) ? trimmed : `${trimmed} GMT`);
  if (Number.isNaN(at)) {
    return null;
  }
  const seconds = Math.ceil((at - now.getTime()) / 1000);
  return Math.min(Math.max(seconds, 0), MAX_RETRY_AFTER_SECONDS);
}

// A JSON call to a third-party API (a GET, or a write with a JSON body), with the details every app's own copy has to
// get right: a timeout, no redirect followed (a key in a header or the URL never reaches another host), and every
// failure returned as a code. A caught error's message is never read, since it can quote the URL and some APIs put
// the key there. The body stays `unknown` unless a zod schema narrows it. Response headers are read only by name from
// the caller's allow-list, so nothing secret is surfaced by accident.
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
  readonly idempotencyKey?: never;
}

/** A write: the body is sent as JSON, and an answer with no body is `ok(undefined)`. */
export interface RequestJsonWriteOptions extends RequestJsonOptions {
  readonly method: HttpJsonWriteMethod;
  /** Serialised with `JSON.stringify`; `undefined` sends no body. A value JSON cannot represent throws. */
  readonly body?: unknown;
  /** Sent as `Idempotency-Key`, for providers that deduplicate retried writes by it. */
  readonly idempotencyKey?: string;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_RETRY_AFTER_SECONDS = 86_400;
// An RFC 9110 token: what a header name may be made of.
const HEADER_NAME_PATTERN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

/**
 * Call `url` (a GET unless `method` says otherwise) and read its JSON body. Without a schema the value is `unknown`,
 * for the caller to narrow; with one it is the schema's output. A write answered with an empty body (a 204) is
 * `ok(undefined)`, schema or not. 3xx, 401 and 403 are refused, 409 and 412 a conflict, 429 rate limited, 5xx
 * unavailable, and any other non-2xx status or a body that is not JSON or fails the schema an unexpected answer.
 * With `readHeaders` the value is `{ body, headers }`, and a failure that had a response carries `headers` too.
 */
export function requestJson<S extends z.ZodType, const H extends string>(
  options: RequestJsonSchemaOptions<S> & RequestJsonReadOptions & RequestJsonReadHeadersOptions<H>,
): Promise<Ok<HttpJsonAnswer<z.output<S>, H>> | HttpJsonFailure>;
export function requestJson<S extends z.ZodType, const H extends string>(
  options: RequestJsonSchemaOptions<S> & RequestJsonWriteOptions & RequestJsonReadHeadersOptions<H>,
): Promise<Ok<HttpJsonAnswer<z.output<S> | undefined, H>> | HttpJsonFailure>;
export function requestJson<const H extends string>(
  options: (RequestJsonReadOptions | RequestJsonWriteOptions) & RequestJsonReadHeadersOptions<H>,
): Promise<Ok<HttpJsonAnswer<unknown, H>> | HttpJsonFailure>;
export function requestJson<S extends z.ZodType>(
  options: RequestJsonSchemaOptions<S> & RequestJsonReadOptions & WithoutReadHeaders,
): Promise<Ok<z.output<S>> | HttpJsonFailure>;
export function requestJson<S extends z.ZodType>(
  options: RequestJsonSchemaOptions<S> & RequestJsonWriteOptions & WithoutReadHeaders,
): Promise<Ok<z.output<S> | undefined> | HttpJsonFailure>;
export function requestJson(
  options: (RequestJsonReadOptions | RequestJsonWriteOptions) & WithoutReadHeaders,
): Promise<Ok<unknown> | HttpJsonFailure>;
export async function requestJson(
  options: (RequestJsonReadOptions | RequestJsonWriteOptions) & {
    readonly schema?: z.ZodType;
    readonly readHeaders?: readonly string[];
  },
): Promise<Ok<unknown> | HttpJsonFailure> {
  // Before anything is sent: a write must not go out when its answer cannot be read.
  assertHeaderNames(options.readHeaders);
  const fetchFunction = options.fetch ?? globalThis.fetch;
  const method = options.method ?? "GET";
  const isWrite = method !== "GET";
  // Outside the try on purpose: a body JSON cannot represent is the caller's bug, not an unreachable service.
  const body = options.body === undefined ? undefined : JSON.stringify(options.body);

  let response: Response;
  try {
    // Inside the try: an invalid header value throws a message that quotes it.
    const headers = new Headers(options.headers);
    if (!headers.has("accept")) {
      headers.set("accept", "application/json");
    }
    if (body !== undefined && !headers.has("content-type")) {
      headers.set("content-type", "application/json");
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
    return httpFailure("core.http_unreachable", null);
  }

  const headers = options.readHeaders === undefined ? undefined : readResponseHeaders(response, options.readHeaders);
  const fail = (code: HttpJsonFailureCode): HttpJsonFailure =>
    withHeaders(responseFailure(code, response, options.clock ?? systemClock), headers);
  const succeed = (body: unknown): Ok<unknown> => ok(headers === undefined ? body : { body, headers });

  const statusFailureCode = getStatusFailureCode(response);
  if (statusFailureCode !== null) {
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

function getStatusFailureCode(response: Response): HttpJsonFailureCode | null {
  const { status } = response;
  if (response.type === "opaqueredirect" || (status >= 300 && status < 400) || status === 401 || status === 403) {
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

function httpFailure(code: Exclude<HttpJsonFailureCode, HttpJsonRetryableCode>, status: number | null): HttpJsonFailure {
  return { ...err(code), status };
}

function responseFailure(code: HttpJsonFailureCode, response: Response, clock: Clock): HttpJsonFailure {
  if (code === "core.http_rate_limited" || code === "core.http_unavailable") {
    const retryAfterSeconds = getRetryAfterSeconds(response.headers.get("retry-after"), clock.now());
    return { ...err(code), status: response.status, retryAfterSeconds };
  }
  return httpFailure(code, response.status);
}

function withHeaders(failure: HttpJsonFailure, headers: HttpJsonResponseHeaders | undefined): HttpJsonFailure {
  return headers === undefined ? failure : { ...failure, headers };
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

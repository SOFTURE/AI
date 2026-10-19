// A JSON GET to a third-party API, with the details every app's own copy has to get right: a timeout, no redirect
// followed (a key in a header or the URL never reaches another host), and every failure returned as a code. A caught
// error's message is never read, since it can quote the URL and some APIs put the key there. The body stays
// `unknown` unless a zod schema narrows it.
import type { z } from "zod";
import { err, ok, type Err, type Ok } from "./result.js";

export type HttpJsonFailureCode =
  | "core.http_unreachable"
  | "core.http_refused"
  | "core.http_rate_limited"
  | "core.http_unavailable"
  | "core.http_unexpected_answer";

/** A failed `requestJson`: the code and the HTTP status (`null` when no response arrived). Nothing else. */
export type HttpJsonFailure = Err<HttpJsonFailureCode> & { readonly status: number | null };

export type FetchFunction = (input: string | URL, init: RequestInit) => Promise<Response>;

export interface RequestJsonOptions {
  readonly url: string | URL;
  /** Defaults to the global `fetch`; tests pass a fake. */
  readonly fetch?: FetchFunction;
  readonly headers?: HeadersInit;
  /** Milliseconds before the request (body included) gives up. Defaults to 10 000. */
  readonly timeoutMs?: number;
}

export interface RequestJsonSchemaOptions<S extends z.ZodType> extends RequestJsonOptions {
  readonly schema: S;
}

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * GET `url` and read its JSON body. Without a schema the value is `unknown`, for the caller to narrow; with one
 * it is the schema's output. 3xx, 401 and 403 are refused, 429 rate limited, 5xx unavailable, and any other
 * non-2xx status or a body that is not JSON or fails the schema an unexpected answer.
 */
export function requestJson<S extends z.ZodType>(
  options: RequestJsonSchemaOptions<S>,
): Promise<Ok<z.output<S>> | HttpJsonFailure>;
export function requestJson(options: RequestJsonOptions): Promise<Ok<unknown> | HttpJsonFailure>;
export async function requestJson(
  options: RequestJsonOptions & { readonly schema?: z.ZodType },
): Promise<Ok<unknown> | HttpJsonFailure> {
  const fetchFunction = options.fetch ?? globalThis.fetch;

  let response: Response;
  try {
    // Inside the try: an invalid header value throws a message that quotes it.
    const headers = new Headers(options.headers);
    if (!headers.has("accept")) {
      headers.set("accept", "application/json");
    }
    response = await fetchFunction(options.url, {
      method: "GET",
      headers,
      redirect: "manual",
      signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
  } catch {
    // Network error or timeout. The error's text can quote the URL, so it is dropped on purpose.
    return httpFailure("core.http_unreachable", null);
  }

  const statusFailure = getStatusFailure(response);
  if (statusFailure !== null) {
    // Release the connection; a body that cannot be cancelled changes nothing for the caller.
    await response.body?.cancel().catch(() => undefined);
    return statusFailure;
  }

  let text: string;
  try {
    text = await response.text();
  } catch {
    // The body broke off, usually the timeout firing mid-body.
    return httpFailure("core.http_unreachable", response.status);
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return httpFailure("core.http_unexpected_answer", response.status);
  }

  if (options.schema === undefined) {
    return ok(body);
  }
  // The schema's issues can quote the body's values, so only the code leaves.
  const parsed = options.schema.safeParse(body);
  return parsed.success ? ok(parsed.data) : httpFailure("core.http_unexpected_answer", response.status);
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

function getStatusFailure(response: Response): HttpJsonFailure | null {
  const { status } = response;
  if (response.type === "opaqueredirect" || (status >= 300 && status < 400) || status === 401 || status === 403) {
    return httpFailure("core.http_refused", status);
  }
  if (status === 429) {
    return httpFailure("core.http_rate_limited", status);
  }
  if (status >= 500) {
    return httpFailure("core.http_unavailable", status);
  }
  if (status < 200 || status >= 300) {
    return httpFailure("core.http_unexpected_answer", status);
  }
  return null;
}

function httpFailure(code: HttpJsonFailureCode, status: number | null): HttpJsonFailure {
  return { ...err(code), status };
}

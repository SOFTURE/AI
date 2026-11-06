/**
 * Why a paid provider call failed, as values an app can log and act on (issue #1141). Every field is safe to log:
 * no key, path, transcript or audio content. `message` is the provider's own message, truncated.
 * - `refused`: the provider answered a 4xx other than 408 and 429 (a bad input, key or balance). Asking again fails
 *   the same way.
 * - `rate_limited`: 429. `unavailable`: 5xx. `timeout`: 408 or the request timed out. `connection`: no answer.
 */
export interface ProviderFailure {
  kind: ProviderFailureKind;
  /** The HTTP status; null when the provider never answered. */
  status: number | null;
  /** The provider's error code (e.g. `audio_too_short`); null when it gave none. */
  code: string | null;
  /** The provider's message, at most `PROVIDER_MESSAGE_LENGTH` characters; null when it gave none. */
  message: string | null;
  /** The provider's request id (header `request-id` or `x-request-id`, or the body's `request_id`). */
  requestId: string | null;
  /** True for 5xx, 408, 429, a timeout and a failed connection: asking again may succeed. */
  isRetryable: boolean;
}

export type ProviderFailureKind = "refused" | "rate_limited" | "unavailable" | "timeout" | "connection";

export const PROVIDER_MESSAGE_LENGTH = 300;

const REQUEST_ID_HEADERS = ["request-id", "x-request-id"];

/** The kind of an HTTP status the provider answered (not 2xx). */
export function getProviderFailureKind(status: number): ProviderFailureKind {
  if (status === 429) return "rate_limited";
  if (status === 408) return "timeout";
  if (status >= 500) return "unavailable";
  return "refused";
}

const isRetryableKind = (kind: ProviderFailureKind): boolean => kind !== "refused";

const truncate = (text: string): string | null => {
  const trimmed = text.trim();
  return trimmed.length === 0 ? null : trimmed.slice(0, PROVIDER_MESSAGE_LENGTH);
};

const readString = (value: unknown): string | null => (typeof value === "string" && value.trim().length > 0 ? value.trim() : null);

interface ErrorBody {
  code: string | null;
  message: string | null;
  requestId: string | null;
}

/** The provider's code, message and request id from an error body: `{ detail: { code | status, message, request_id } }`, `{ detail: "…" }` or text. */
export function readProviderErrorBody(text: string): ErrorBody {
  let body: unknown;
  try {
    body = JSON.parse(text) as unknown;
  } catch {
    return { code: null, message: truncate(text), requestId: null };
  }
  const root = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  const detail = root.detail ?? root.error ?? root;
  if (typeof detail === "string") return { code: null, message: truncate(detail), requestId: readString(root.request_id) };
  const fields = typeof detail === "object" && detail !== null ? (detail as Record<string, unknown>) : {};
  const message = readString(fields.message);
  return {
    code: readString(fields.code) ?? readString(fields.status) ?? readString(fields.type),
    message: message === null ? null : truncate(message),
    requestId: readString(fields.request_id) ?? readString(root.request_id),
  };
}

/** The failure of a response that is not 2xx, from its status, headers and body text. */
export function getProviderFailure(response: Response, text: string): ProviderFailure {
  const body = readProviderErrorBody(text);
  const header = REQUEST_ID_HEADERS.map((name) => readString(response.headers.get(name))).find((value) => value !== null) ?? null;
  const kind = getProviderFailureKind(response.status);
  return { kind, status: response.status, code: body.code, message: body.message, requestId: header ?? body.requestId, isRetryable: isRetryableKind(kind) };
}

/** The failure of a request that got no answer: `timeout` when it timed out, `connection` otherwise. */
export function getConnectionFailure(error: unknown): ProviderFailure {
  const kind: ProviderFailureKind = error instanceof Error && error.name === "TimeoutError" ? "timeout" : "connection";
  return { kind, status: null, code: null, message: null, requestId: null, isRetryable: true };
}

/** A failure the kit decides before any request (e.g. a missing key): `refused`, with the kit's own code. */
export function getLocalRefusal(code: string): ProviderFailure {
  return { kind: "refused", status: null, code, message: null, requestId: null, isRetryable: false };
}

/** The failure in one line for a log: kind, status, code, request id and message. */
export function describeProviderFailure(failure: ProviderFailure): string {
  const parts: string[] = [failure.kind];
  if (failure.status !== null) parts.push(String(failure.status));
  if (failure.code !== null) parts.push(failure.code);
  if (failure.requestId !== null) parts.push(`request ${failure.requestId}`);
  const head = parts.join(", ");
  return failure.message === null ? head : `${head}: ${failure.message}`;
}

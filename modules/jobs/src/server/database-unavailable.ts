// Whether a failure means the database is unavailable (a restart, a shutdown, a refused or closed connection) rather
// than a query that failed on its own. A closed list, so nothing else is taken for an outage.

/** SQLSTATEs of a server that shuts down or is not ready yet: admin_shutdown, crash_shutdown, cannot_connect_now. */
const UNAVAILABLE_SQLSTATES: ReadonlySet<string> = new Set(["57P01", "57P02", "57P03"]);
/** SQLSTATE class 08: connection exception. */
const CONNECTION_EXCEPTION_CLASS = "08";
/** Node socket codes of a connection that was refused, reset, timed out or could not be resolved. */
const SOCKET_CODES: ReadonlySet<string> = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "EPIPE",
  "ETIMEDOUT",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ENOTFOUND",
  "EAI_AGAIN",
]);
/** `pg` and `pg-pool` messages of a lost or never-made connection, which carry no code. */
const CONNECTION_MESSAGES: readonly RegExp[] = [
  /^Connection terminated\b/,
  /^Client has encountered a connection error and is not queryable$/,
  /^timeout exceeded when trying to connect$/,
];
/** How deep `cause` and `AggregateError.errors` are followed; a cycle stops here. */
const MAX_DEPTH = 5;

/**
 * True when `error` (or its `cause`, or one of an `AggregateError`'s `errors`) says the database is unavailable:
 * SQLSTATE 57P01 to 57P03 or class 08, a refused, reset, timed-out or unresolved socket, or a `pg` connection message
 * without a code. False for anything else, including a non-error.
 */
export function isDatabaseUnavailableError(error: unknown): boolean {
  return isUnavailable(error, 0);
}

function isUnavailable(value: unknown, depth: number): boolean {
  if (depth > MAX_DEPTH || !(value instanceof Error)) return false;
  const code = "code" in value && typeof value.code === "string" ? value.code : undefined;
  if (code !== undefined && isUnavailableCode(code)) return true;
  if (code === undefined && CONNECTION_MESSAGES.some((pattern) => pattern.test(value.message))) return true;
  if (value instanceof AggregateError && value.errors.some((inner: unknown) => isUnavailable(inner, depth + 1))) return true;
  return isUnavailable(value.cause, depth + 1);
}

function isUnavailableCode(code: string): boolean {
  if (SOCKET_CODES.has(code)) return true;
  if (!/^[0-9A-Z]{5}$/.test(code)) return false;
  return UNAVAILABLE_SQLSTATES.has(code) || code.startsWith(CONNECTION_EXCEPTION_CLASS);
}

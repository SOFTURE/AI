// Turning a caught error into something safe to hand outside the process: a Drizzle
// `Failed query: … params: …` once reached a chat transcript through a success payload. The
// scrubbing happens where the error is caught, so a value that never carried the SQL cannot leak
// it later. Copy for the codes lives in `messages`. The one exception is a `PublicError`, whose
// message the code wrote for the user on purpose; `getPublicMessage` hands that text out.
import { err, type Err } from "./result.js";

export type CoreErrorCode = "core.database_failed" | "core.unexpected";

/**
 * A failure result for an unexpected error, with nothing of the error's text in it.
 * The caller logs `errorLogLabel(error)` when it needs a trace.
 */
export function safeError(error: unknown): Err<CoreErrorCode> {
  return err(isDatabaseError(error) ? "core.database_failed" : "core.unexpected");
}

const PUBLIC_ERROR_BRAND = Symbol.for("softure.public-error");

/**
 * An error whose message is written for the user ("This plan has ended; pick another one."), thrown
 * deliberately by domain code. Its message is safe to show; every other error's is not. Branded with
 * a registry symbol, so it is still recognised when an app ends up with two copies of core.
 */
export class PublicError extends Error {
  readonly [PUBLIC_ERROR_BRAND] = true;

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "PublicError";
  }
}

/** Whether `error` is a `PublicError`, from this copy of core or another. */
export function isPublicError(error: unknown): error is PublicError {
  return error instanceof Error && (error as Error & { [PUBLIC_ERROR_BRAND]?: unknown })[PUBLIC_ERROR_BRAND] === true;
}

/**
 * The message of a `PublicError`, or `null` for anything else: the pass-through for deliberate
 * domain messages, next to `safeError` for the rest (`getPublicMessage(error) ?? t(safeError(error).error)`).
 */
export function getPublicMessage(error: unknown): string | null {
  return isPublicError(error) ? error.message : null;
}

/**
 * A log label for an error on a path that handles personal data: the kind of error, never its
 * text. Returns the class name and, when present, the Postgres SQLSTATE (also looked up on
 * `cause`, where Drizzle keeps the driver error).
 */
export function errorLogLabel(error: unknown): string {
  if (!(error instanceof Error)) {
    return typeof error;
  }

  const code = readSqlState(error) ?? readSqlState(error.cause);
  return code === null ? error.name : `${error.name} code=${code}`;
}

function isDatabaseError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : "";
  // Drizzle's shape: `Failed query: <sql>\nparams: <params>`.
  if (/^Failed query:/.test(message)) {
    return true;
  }
  // A bare statement without Drizzle's prefix. Matched on `select … from "`, so a sentence that
  // merely contains the word "select" is not taken for a query.
  return /\bselect\b[\s\S]*\bfrom\b\s+"/i.test(message);
}

/** A five-character SQLSTATE, or `null`: anything else could be free text. */
function readSqlState(value: unknown): string | null {
  if (typeof value !== "object" || value === null || !("code" in value)) {
    return null;
  }

  const code = value.code;
  return typeof code === "string" && /^[0-9A-Z]{5}$/.test(code) ? code : null;
}

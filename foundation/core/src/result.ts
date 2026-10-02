// The return type of every expected failure in SOFTURE modules (docs/02-module-standard.md §9).
// Exceptions stay for programming errors; anything a caller is expected to handle is a value.

/** An error code namespaced by the module that raises it, e.g. `auth.invalid_credentials`. */
export type ErrorCode = `${string}.${string}`;

export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

export interface Err<E extends ErrorCode> {
  readonly ok: false;
  readonly error: E;
}

export type Result<T, E extends ErrorCode = ErrorCode> = Ok<T> | Err<E>;

/** A success. `ok()` without a value is the success of an operation that returns nothing. */
export function ok(): Ok<undefined>;
export function ok<T>(value: T): Ok<T>;
export function ok<T>(value?: T): Ok<T | undefined> {
  return { ok: true, value };
}

/** A failure carrying only its code; the UI translates the code through `messages`. */
export function err<E extends ErrorCode>(error: E): Err<E> {
  return { ok: false, error };
}

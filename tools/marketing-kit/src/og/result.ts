/** An expected failure is a value: the message names the operation and the input that failed. */
export type OgResult<T> = { ok: true; value: T } | { ok: false; error: string };

export const ok = <T>(value: T): OgResult<T> => ({ ok: true, value });
export const err = <T>(error: string): OgResult<T> => ({ ok: false, error });

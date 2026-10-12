// Raw SQL over whichever driver a handle or URL uses, for operator and report scripts that read with plain SQL
// instead of drizzle. Values are always passed separately ($1, $2, …), never spliced into the text.
import { createDatabase, type CreateDatabaseOptions, type DatabaseHandle } from "./client.js";

export interface RawDatabase {
  readonly kind: DatabaseHandle["kind"];
  /** Runs `text` with `values` bound to `$1`, `$2`, … and returns the rows. */
  readonly query: <TRow = Record<string, unknown>>(text: string, values?: readonly unknown[]) => Promise<TRow[]>;
  /** Closes the handle this database opened; a `pglite://<dir>` database is written back only then. */
  readonly close: () => Promise<void>;
}

/** Runs a parameterized query on the handle's pool (node-postgres) or client (PGlite) and returns its rows. */
export async function queryDatabase<TRow = Record<string, unknown>>(
  handle: DatabaseHandle,
  text: string,
  values: readonly unknown[] = [],
): Promise<TRow[]> {
  if (handle.kind === "postgres") {
    const result = await handle.pool.query(text, [...values]);
    return result.rows as TRow[];
  }
  const result = await handle.client.query<TRow>(text, [...values]);
  return result.rows;
}

/**
 * Opens a new handle on `url` (not the process-wide one) for a script's raw queries. The script closes it at its
 * end. Throws on an empty URL or an unsupported scheme, as `createDatabase` does.
 */
export async function openRawDatabase(url: string, options: CreateDatabaseOptions = {}): Promise<RawDatabase> {
  const handle = await createDatabase(url, options);
  return {
    kind: handle.kind,
    query: (text, values) => queryDatabase(handle, text, values),
    close: handle.close,
  };
}

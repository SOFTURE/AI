// The database handle of the health route. Package code cannot reach the app's pool, so ops keeps
// one small pool per URL. It lives on globalThis under a `Symbol.for` key: `next dev` re-evaluates
// modules on every change, and separate server bundles share it instead of opening a pool each.
import { createDatabase, type DatabaseHandle } from "@softure-ai/db";

const DATABASES_KEY = Symbol.for("@softure-ai/ops/databases");
// Health runs one `select 1` at a time per process (single flight); two connections leave room
// for a probe while a timed-out query still holds the other.
const POOL_SIZE = 2;

type DatabaseMap = Map<string, Promise<DatabaseHandle>>;
type DatabaseHost = Record<typeof DATABASES_KEY, DatabaseMap | undefined>;

const host = globalThis as unknown as DatabaseHost;

/** The handle for `url`, opened on first use. A failed open is not kept: the next probe tries again. */
export function getHealthDatabase(url: string): Promise<DatabaseHandle> {
  const databases = (host[DATABASES_KEY] ??= new Map<string, Promise<DatabaseHandle>>());
  let database = databases.get(url);
  if (database === undefined) {
    database = createDatabase(url, { max: POOL_SIZE });
    databases.set(url, database);
    database.catch(() => databases.delete(url));
  }
  return database;
}

/** Closes every handle the health route opened. For tests and graceful shutdowns. */
export async function closeHealthDatabases(): Promise<void> {
  const databases = host[DATABASES_KEY];
  host[DATABASES_KEY] = undefined;
  const handles = await Promise.allSettled([...(databases?.values() ?? [])]);
  await Promise.all(handles.map((handle) => (handle.status === "fulfilled" ? handle.value.close() : Promise.resolve())));
}

// One database handle per URL for the whole server process, shared by every module's Next.js
// adapter and the app. Package code cannot import the app's own handle, and `next dev` re-evaluates
// modules on every change, so the handles live on `globalThis` under a `Symbol.for` key: each
// reload, and each copy of this file in separate server bundles, finds the same pool.
import { createDatabase, type CreateDatabaseOptions, type DatabaseHandle } from "./client.js";

const HANDLES_KEY = Symbol.for("@softure-ai/db/shared-handles");

type HandleHost = Record<typeof HANDLES_KEY, Map<string, Promise<DatabaseHandle>> | undefined>;

const host = globalThis as unknown as HandleHost;

/**
 * The process-wide handle for `url`, opened on first use. `options` apply only to that first call.
 * A failed open is not kept, so the next call tries again.
 */
export function getSharedDatabase(url: string, options: CreateDatabaseOptions = {}): Promise<DatabaseHandle> {
  const handles = (host[HANDLES_KEY] ??= new Map<string, Promise<DatabaseHandle>>());
  let handle = handles.get(url);
  if (handle === undefined) {
    handle = createDatabase(url, options);
    handles.set(url, handle);
    handle.catch(() => handles.delete(url));
  }
  return handle;
}

/** Closes and forgets every shared handle. For tests and graceful shutdown. */
export async function closeSharedDatabases(): Promise<void> {
  const handles = host[HANDLES_KEY];
  if (handles === undefined) return;
  const opened = [...handles.values()];
  handles.clear();
  const results = await Promise.allSettled(opened);
  await Promise.all(results.flatMap((result) => (result.status === "fulfilled" ? [result.value.close()] : [])));
}

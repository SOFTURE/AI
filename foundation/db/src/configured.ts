// The handle a config's database resolves to: the app's own (`database.handle`) when it set one, so one
// process never holds two handles on one database (with `pglite://`, two PGlite instances on one directory
// corrupt it), otherwise the process-wide handle for `database.url`. Module adapters, the health route and the
// package commands all resolve through here.
import type { SoftureDatabaseConfig } from "@softure-ai/core";
import { createDatabase, isDatabaseHandle, type CreateDatabaseOptions, type DatabaseHandle } from "./client.js";
import { getSharedDatabase } from "./shared.js";

declare module "@softure-ai/core" {
  interface SoftureDatabaseHandleTypes {
    readonly handle: DatabaseHandle;
  }
}

type HandleSource = NonNullable<SoftureDatabaseConfig["handle"]>;

const CONFIGURED_KEY = Symbol.for("@softure-ai/db/configured-handles");

interface ConfiguredHandles {
  /** Keyed by the app's function: `next dev` re-evaluates the config, and a new function is a new entry. */
  readonly byFunction: WeakMap<HandleSource, Promise<DatabaseHandle>>;
  /** The same promises, so `closeConfiguredDatabases` can reach them. */
  readonly open: Set<Promise<DatabaseHandle>>;
}

type HandleHost = Record<typeof CONFIGURED_KEY, ConfiguredHandles | undefined>;

const host = globalThis as unknown as HandleHost;

function getConfiguredHandles(): ConfiguredHandles {
  return (host[CONFIGURED_KEY] ??= { byFunction: new WeakMap(), open: new Set() });
}

/**
 * The handle for the config's database: the app's `database.handle`, called once per function and checked, or
 * else `getSharedDatabase(database.url)`. Never closes anything; for a server's whole life. A failed or invalid
 * `handle` call is not kept, so the next call tries again.
 */
export function getConfiguredDatabase(database: SoftureDatabaseConfig): Promise<DatabaseHandle> {
  const source = database.handle;
  if (source === undefined) return getSharedDatabase(database.url);

  const handles = getConfiguredHandles();
  let handle = handles.byFunction.get(source);
  if (handle === undefined) {
    handle = resolveHandle(source);
    const opened = handle;
    handles.byFunction.set(source, opened);
    handles.open.add(opened);
    opened.catch(() => {
      handles.byFunction.delete(source);
      handles.open.delete(opened);
    });
  }
  return handle;
}

async function resolveHandle(source: HandleSource): Promise<DatabaseHandle> {
  const value: unknown = await source();
  if (!isDatabaseHandle(value)) {
    throw new Error(
      "database.handle: the function must return a database handle; wrap the app's client with createPostgresHandle(pool) or createPgliteHandle(client) from @softure-ai/db",
    );
  }
  return value;
}

export interface CommandDatabase {
  readonly handle: DatabaseHandle;
  /** Closes what the command opened: its own handle, or the app's configured one (and forgets it). */
  readonly close: () => Promise<void>;
}

/**
 * The database for a command's own process (`softure migrate`, a module CLI, an ops script): the app's
 * configured handle when `database.handle` is set, so the app's hooks and the command share one instance,
 * otherwise a new handle on `database.url` with `options`. `close` closes either one; a `pglite://` directory is
 * written back only then. Not for a running server: closing would close the app's handle under it.
 */
export async function openCommandDatabase(database: SoftureDatabaseConfig, options: CreateDatabaseOptions = {}): Promise<CommandDatabase> {
  const source = database.handle;
  if (source === undefined) {
    const handle = await createDatabase(database.url, options);
    return { handle, close: handle.close };
  }
  const opened = getConfiguredDatabase(database);
  const handle = await opened;
  return {
    handle,
    close: async () => {
      const handles = getConfiguredHandles();
      handles.byFunction.delete(source);
      handles.open.delete(opened);
      await handle.close();
    },
  };
}

/**
 * Closes and forgets every configured handle this process resolved. For tests; at shutdown the app closes its own
 * handle, which it owns (`closeSharedDatabases` leaves configured handles alone for that reason).
 */
export async function closeConfiguredDatabases(): Promise<void> {
  const handles = host[CONFIGURED_KEY];
  if (handles === undefined) return;
  host[CONFIGURED_KEY] = undefined;
  const results = await Promise.allSettled([...handles.open]);
  await Promise.all(results.flatMap((result) => (result.status === "fulfilled" ? [result.value.close()] : [])));
}

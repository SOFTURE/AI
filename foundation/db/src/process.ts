// A process-wide database for an app whose code imports one module-level `db` (drizzle queries everywhere)
// instead of awaiting a handle in every function. `db` is a synchronous stand-in for the shared handle's
// drizzle instance: each entry point (the server's startup, a script's main) opens it first, and a query
// before that throws instead of silently opening a second pool.
import type { Database, DatabaseHandle, DatabaseSchema, CreateDatabaseOptions } from "./client.js";
import { closeSharedDatabase, getSharedDatabase } from "./shared.js";

const NOT_OPEN_MESSAGE = "Database is not open: call open() or withDatabase() at the process entry before querying";
const REGISTRY_KEY = Symbol.for("@softure-ai/db/process-databases");

/** What one process database holds between `open()` and `close()`; on `globalThis` when it has a `globalKey`. */
interface ProcessState {
  opening: Promise<DatabaseHandle> | undefined;
  opened: { readonly url: string; readonly db: Database<DatabaseSchema> } | undefined;
}

type StateHost = Record<symbol, ProcessState | Set<ProcessState> | undefined>;

const host = globalThis as unknown as StateHost;

export interface ProcessDatabaseOptions<TSchema extends DatabaseSchema> extends CreateDatabaseOptions {
  /** The app's drizzle schema: `db` is built with it, so `db.query.<table>` is typed and works. */
  readonly schema?: TSchema;
  /**
   * Keeps the open database on `globalThis` under this key, so a module that `next dev` re-evaluates (HMR) finds the
   * database its previous evaluation opened instead of refusing queries. One key per database in the process. The
   * open `db` keeps the schema it was opened with; a changed schema takes effect after `close()` or a restart.
   */
  readonly globalKey?: string;
}

export interface ProcessDatabase<TSchema extends DatabaseSchema = DatabaseSchema> {
  /** The open database. Usable from module scope; a query before `open()` resolves throws "Database is not open". */
  readonly db: Database<TSchema>;
  /** Opens the process-wide handle for the URL (`getSharedDatabase`), once; later calls return the same handle. */
  readonly open: () => Promise<DatabaseHandle>;
  /** Closes the handle and forgets it, so `db` refuses queries again. Does nothing when not open. */
  readonly close: () => Promise<void>;
  /** For a script: opens, runs `main` with `db`, and closes whether `main` resolves or throws. */
  readonly withDatabase: <T>(main: (db: Database<TSchema>) => Promise<T>) => Promise<T>;
  readonly isOpen: () => boolean;
}

/**
 * A module-level database for the process. `url` may be a function, read on `open()`, so a script can load its
 * environment after importing the module that creates it. The handle is the one `getSharedDatabase(url)` gives the
 * modules, so the app and the modules share one pool (db README §3, "One handle per process").
 */
export function createProcessDatabase<TSchema extends DatabaseSchema = DatabaseSchema>(
  url: string | (() => string),
  options: ProcessDatabaseOptions<TSchema> = {},
): ProcessDatabase<TSchema> {
  const { schema, globalKey, ...databaseOptions } = options;
  const state = getProcessState(globalKey);

  const open = (): Promise<DatabaseHandle> => {
    if (state.opening === undefined) {
      getRegistry().add(state);
      state.opening = openHandle().catch((error: unknown) => {
        state.opening = undefined;
        getRegistry().delete(state);
        throw error;
      });
    }
    return state.opening;
  };

  async function openHandle(): Promise<DatabaseHandle> {
    const resolvedUrl = typeof url === "function" ? url() : url;
    const handle = await getSharedDatabase(resolvedUrl, databaseOptions);
    state.opened = { url: resolvedUrl, db: await buildDatabase(handle, schema) };
    return handle;
  }

  const close = (): Promise<void> => closeProcessState(state);

  const withDatabase = async <T>(main: (db: Database<TSchema>) => Promise<T>): Promise<T> => {
    await open();
    try {
      return await main(db);
    } finally {
      await close();
    }
  };

  // The state holds whichever schema opened it; this instance's callers see it typed with their own.
  const db = createDatabaseProxy(() => state.opened?.db as Database<TSchema> | undefined);

  return { db, open, close, withDatabase, isOpen: () => state.opened !== undefined };
}

/**
 * Closes every process database this process opened (with or without `globalKey`), so each `db` refuses queries
 * until its `open()`. For tests' `afterEach`; a server's shutdown closes its own.
 */
export async function closeProcessDatabases(): Promise<void> {
  await Promise.all([...getRegistry()].map(closeProcessState));
}

function getProcessState(globalKey: string | undefined): ProcessState {
  if (globalKey === undefined) return { opening: undefined, opened: undefined };
  const key = Symbol.for(`@softure-ai/db/process:${globalKey}`);
  const existing = host[key];
  if (existing !== undefined && !(existing instanceof Set)) return existing;
  const created: ProcessState = { opening: undefined, opened: undefined };
  host[key] = created;
  return created;
}

function getRegistry(): Set<ProcessState> {
  const existing = host[REGISTRY_KEY];
  if (existing instanceof Set) return existing;
  const created = new Set<ProcessState>();
  host[REGISTRY_KEY] = created;
  return created;
}

async function closeProcessState(state: ProcessState): Promise<void> {
  getRegistry().delete(state);
  if (state.opening === undefined) return;
  const pending = state.opening;
  state.opening = undefined;
  await pending.catch(() => undefined);
  const current = state.opened;
  state.opened = undefined;
  if (current !== undefined) await closeSharedDatabase(current.url);
}

/** The handle's drizzle instance, or a new one over the same pool or client when the app passes its schema. */
async function buildDatabase<TSchema extends DatabaseSchema>(handle: DatabaseHandle, schema: TSchema | undefined): Promise<Database<TSchema>> {
  // The handle's own instance is typed with the default schema; without the app's schema the two types agree.
  if (schema === undefined) return handle.db as unknown as Database<TSchema>;
  if (handle.kind === "postgres") {
    const { drizzle } = await import("drizzle-orm/node-postgres");
    return drizzle({ client: handle.pool, schema });
  }
  const { drizzle } = await import("drizzle-orm/pglite");
  return drizzle({ client: handle.client, schema });
}

/** A stand-in that forwards every property to the open database, or throws when none is open. */
function createDatabaseProxy<TSchema extends DatabaseSchema>(getDatabase: () => Database<TSchema> | undefined): Database<TSchema> {
  return new Proxy({} as Database<TSchema>, {
    get(_target, property) {
      const database = getDatabase();
      if (database === undefined) {
        // `await db` and `Promise.resolve(db)` look for `then`: a closed database is just not a thenable.
        if (property === "then") return undefined;
        throw new Error(NOT_OPEN_MESSAGE);
      }
      const value: unknown = Reflect.get(database, property, database);
      return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(database) : value;
    },
    has(_target, property) {
      const database = getDatabase();
      if (database === undefined) throw new Error(NOT_OPEN_MESSAGE);
      return Reflect.has(database, property);
    },
  });
}

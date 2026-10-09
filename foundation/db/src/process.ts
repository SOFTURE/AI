// A process-wide database for an app whose code imports one module-level `db` (drizzle queries everywhere)
// instead of awaiting a handle in every function. `db` is a synchronous stand-in for the shared handle's
// drizzle instance: each entry point (the server's startup, a script's main) opens it first, and a query
// before that throws instead of silently opening a second pool.
import type { Database, DatabaseHandle, DatabaseSchema, CreateDatabaseOptions } from "./client.js";
import { closeSharedDatabase, getSharedDatabase } from "./shared.js";

const NOT_OPEN_MESSAGE = "Database is not open: call open() or withDatabase() at the process entry before querying";

export interface ProcessDatabaseOptions<TSchema extends DatabaseSchema> extends CreateDatabaseOptions {
  /** The app's drizzle schema: `db` is built with it, so `db.query.<table>` is typed and works. */
  readonly schema?: TSchema;
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
  const { schema, ...databaseOptions } = options;
  let opening: Promise<DatabaseHandle> | undefined;
  let opened: { readonly url: string; readonly db: Database<TSchema> } | undefined;

  const open = (): Promise<DatabaseHandle> => {
    opening ??= openHandle().catch((error: unknown) => {
      opening = undefined;
      throw error;
    });
    return opening;
  };

  async function openHandle(): Promise<DatabaseHandle> {
    const resolvedUrl = typeof url === "function" ? url() : url;
    const handle = await getSharedDatabase(resolvedUrl, databaseOptions);
    opened = { url: resolvedUrl, db: await buildDatabase(handle, schema) };
    return handle;
  }

  const close = async (): Promise<void> => {
    if (opening === undefined) return;
    const pending = opening;
    opening = undefined;
    await pending.catch(() => undefined);
    const current = opened;
    opened = undefined;
    if (current !== undefined) await closeSharedDatabase(current.url);
  };

  const withDatabase = async <T>(main: (db: Database<TSchema>) => Promise<T>): Promise<T> => {
    await open();
    try {
      return await main(db);
    } finally {
      await close();
    }
  };

  const db = createDatabaseProxy(() => opened?.db);

  return { db, open, close, withDatabase, isOpen: () => opened !== undefined };
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

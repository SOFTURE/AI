// The database client (FIRE_TRACKER `src/db/client.ts`, generalised). The driver follows the URL:
// `postgres://` or `postgresql://` → node-postgres (production), `pglite://<dir>` → PGlite, a
// real Postgres in-process (dev without a server); `pglite://` alone is an in-memory database.
// Drivers load through dynamic `import()`, so a bundle can keep both external and an app pays
// only for the one it uses.
import type { PGlite } from "@electric-sql/pglite";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import type { Pool } from "pg";

const PGLITE_PREFIX = "pglite://";
const POSTGRES_PREFIXES = ["postgres://", "postgresql://"];

export type PostgresDatabase = NodePgDatabase & { $client: Pool };
export type PgliteClientDatabase = PgliteDatabase & { $client: PGlite };

/** The drizzle database modules and the app query through. */
export type Database = PostgresDatabase | PgliteClientDatabase;

/**
 * A connection *or* an open transaction. Query helpers take this, so one function serves a
 * plain read and a step inside `db.transaction()` (FIRE `client.ts`).
 */
export type Queryable = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

export type DatabaseHandle =
  | {
      readonly kind: "postgres";
      readonly db: PostgresDatabase;
      readonly pool: Pool;
      readonly close: () => Promise<void>;
    }
  | {
      readonly kind: "pglite";
      readonly db: PgliteClientDatabase;
      readonly client: PGlite;
      readonly close: () => Promise<void>;
    };

export interface CreateDatabaseOptions {
  /** Pool size for Postgres; ignored by PGlite, which has a single connection. Default 10. */
  readonly max?: number;
}

/**
 * Opens the database a URL points at. Throws when the scheme is not supported: that is a
 * deployment bug. The message names the scheme only, never the URL, which holds a password.
 */
export async function createDatabase(url: string, options: CreateDatabaseOptions = {}): Promise<DatabaseHandle> {
  if (url.startsWith(PGLITE_PREFIX)) {
    const dataDir = url.slice(PGLITE_PREFIX.length);
    const { PGlite } = await import("@electric-sql/pglite");
    const client = dataDir === "" ? new PGlite() : new PGlite(dataDir);
    return createPgliteHandle(client);
  }
  if (POSTGRES_PREFIXES.some((prefix) => url.startsWith(prefix))) {
    const { default: pg } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const pool = new pg.Pool({ connectionString: url, max: options.max ?? 10 });
    // An idle client that loses its connection emits 'error' on the pool; unhandled, it would
    // crash the process. The pool drops that client and the next query opens a new one.
    pool.on("error", () => undefined);
    return { kind: "postgres", db: drizzle({ client: pool }), pool, close: () => pool.end() };
  }
  throw new Error(
    `createDatabase: unsupported database URL scheme ${describeScheme(url)}; use postgres://, postgresql:// or pglite://<dir>`,
  );
}

/** Wraps an open PGlite instance (used by `createTestDatabase`). */
export async function createPgliteHandle(client: PGlite): Promise<DatabaseHandle & { kind: "pglite" }> {
  const { drizzle } = await import("drizzle-orm/pglite");
  return { kind: "pglite", db: drizzle({ client }), client, close: () => client.close() };
}

function describeScheme(url: string): string {
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(url)?.[1];
  return scheme === undefined ? "(none)" : `"${scheme}:"`;
}

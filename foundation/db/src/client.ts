// The database client. The driver follows the URL:
// `postgres://` or `postgresql://` → node-postgres (production), `pglite://<dir>` → PGlite, a
// real Postgres in-process (dev without a server); `pglite://` alone is an in-memory database.
// Both drivers are optional peers and load through dynamic `import()` only when a URL needs one, so an app
// installs and ships just its own. The specifiers stay literal: a Next.js app lists this package in
// `serverExternalPackages`, and output tracing follows these imports to copy the installed driver.
import type { PGlite } from "@electric-sql/pglite";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import type { Pool } from "pg";

const PGLITE_PREFIX = "pglite://";
const POSTGRES_PREFIXES = ["postgres://", "postgresql://"];
const MODULE_NOT_FOUND_CODES = new Set(["ERR_MODULE_NOT_FOUND", "MODULE_NOT_FOUND"]);

/** The optional peer a URL scheme needs, named in the error when it is not installed. */
export interface DriverRequirement {
  readonly packageName: string;
  readonly scheme: string;
}

const POSTGRES_DRIVER: DriverRequirement = { packageName: "pg", scheme: "postgres://" };
const PGLITE_DRIVER: DriverRequirement = { packageName: "@electric-sql/pglite", scheme: "pglite://" };

/**
 * The drizzle schema a database is typed with. The default accepts any schema, so an app database made with
 * `drizzle({ client, schema })` (and its transactions) can be passed wherever a module takes `Database` or
 * `Queryable`; pass the app's schema to keep its relational `db.query` API typed.
 */
export type DatabaseSchema = Record<string, unknown>;

export type PostgresDatabase<TSchema extends DatabaseSchema = DatabaseSchema> = NodePgDatabase<TSchema> & { $client: Pool };
export type PgliteClientDatabase<TSchema extends DatabaseSchema = DatabaseSchema> = PgliteDatabase<TSchema> & { $client: PGlite };

/** The drizzle database modules and the app query through. */
export type Database<TSchema extends DatabaseSchema = DatabaseSchema> = PostgresDatabase<TSchema> | PgliteClientDatabase<TSchema>;

/**
 * A connection *or* an open transaction. Query helpers take this, so one function serves a
 * plain read and a step inside `db.transaction()`.
 */
export type Queryable<TSchema extends DatabaseSchema = DatabaseSchema> =
  | Database<TSchema>
  | Parameters<Parameters<Database<TSchema>["transaction"]>[0]>[0];

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
 * Opens the database a URL points at. Throws when the URL is empty or its scheme is not supported:
 * that is a deployment bug. The message names the scheme only, never the URL, which holds a password.
 * The config accepts an empty URL (a build has no DATABASE_URL), so this is where it is refused.
 */
export async function createDatabase(url: string, options: CreateDatabaseOptions = {}): Promise<DatabaseHandle> {
  if (url === "") {
    throw new Error("createDatabase: the database URL is empty; set database.url in softure.config (usually from DATABASE_URL)");
  }
  if (url.startsWith(PGLITE_PREFIX)) {
    const dataDir = url.slice(PGLITE_PREFIX.length);
    const { PGlite } = await importDriver(PGLITE_DRIVER, () => import("@electric-sql/pglite"));
    const client = dataDir === "" ? new PGlite() : new PGlite(dataDir);
    return createPgliteHandle(client);
  }
  if (POSTGRES_PREFIXES.some((prefix) => url.startsWith(prefix))) {
    const { default: pg } = await importDriver(POSTGRES_DRIVER, () => import("pg"));
    const pool = new pg.Pool({ connectionString: url, max: options.max ?? 10 });
    // An idle client that loses its connection emits 'error' on the pool; unhandled, it would
    // crash the process. The pool drops that client and the next query opens a new one.
    pool.on("error", () => undefined);
    return createPostgresHandle(pool);
  }
  throw new Error(
    `createDatabase: unsupported database URL scheme ${describeScheme(url)}; use postgres://, postgresql:// or pglite://<dir>`,
  );
}

/**
 * Wraps an open PGlite instance, e.g. the app's own, for `database.handle` in softure.config. `close` closes the
 * instance, which writes a `pglite://<dir>` database back to its directory.
 */
export async function createPgliteHandle(client: PGlite): Promise<DatabaseHandle & { kind: "pglite" }> {
  const { drizzle } = await importDriver(PGLITE_DRIVER, () => import("drizzle-orm/pglite"));
  return { kind: "pglite", db: drizzle({ client }), client, close: () => client.close() };
}

/**
 * Wraps an open node-postgres pool, e.g. the app's own, for `database.handle` in softure.config. `close` ends
 * the pool. The pool's `error` listener stays the app's: add one, or an idle client's lost connection crashes
 * the process.
 */
export async function createPostgresHandle(pool: Pool): Promise<DatabaseHandle & { kind: "postgres" }> {
  const { drizzle } = await importDriver(POSTGRES_DRIVER, () => import("drizzle-orm/node-postgres"));
  return { kind: "postgres", db: drizzle({ client: pool }), pool, close: () => pool.end() };
}

/** Whether `value` has the shape of a `DatabaseHandle` (what `database.handle` must return). */
export function isDatabaseHandle(value: unknown): value is DatabaseHandle {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.db !== "object" || candidate.db === null || typeof candidate.close !== "function") return false;
  if (candidate.kind === "postgres") return typeof candidate.pool === "object" && candidate.pool !== null;
  if (candidate.kind === "pglite") return typeof candidate.client === "object" && candidate.client !== null;
  return false;
}

/**
 * Turns Node's "Cannot find package" for a driver (from the driver import or from drizzle's adapter, which imports
 * it statically) into an error that says what to install. Anything else, including a missing package other than
 * the driver, is returned unchanged.
 */
export function explainMissingDriver(error: unknown, driver: DriverRequirement): unknown {
  if (!(error instanceof Error)) return error;
  const code = (error as Error & { code?: unknown }).code;
  if (typeof code !== "string" || !MODULE_NOT_FOUND_CODES.has(code)) return error;
  if (!error.message.includes(`'${driver.packageName}'`)) return error;
  return new Error(
    `createDatabase: ${driver.scheme} URLs need the "${driver.packageName}" package, which is not installed; run ` +
      `\`npm install ${driver.packageName}\` and, in a Next.js app, list "@softure-ai/db" and "${driver.packageName}" ` +
      "in serverExternalPackages (db README §2)",
    { cause: error },
  );
}

async function importDriver<T>(driver: DriverRequirement, load: () => Promise<T>): Promise<T> {
  try {
    return await load();
  } catch (error) {
    throw explainMissingDriver(error, driver);
  }
}

function describeScheme(url: string): string {
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(url)?.[1];
  return scheme === undefined ? "(none)" : `"${scheme}:"`;
}

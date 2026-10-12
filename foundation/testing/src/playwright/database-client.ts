// A raw client on the integration database for the setup, checks and cleanup of black-box tests: a node-postgres
// pool, queries whose errors name the statement, and row counts. `pg` is an optional peer dependency, loaded only
// when a client is created, so an app that never calls this does not install it.

export interface TestDatabaseClientOptions {
  /** Pool size; default 2, since a test file runs its queries one after another. */
  readonly max?: number;
}

/** A column value to match: `null` matches `IS NULL`. */
export type RowFilterValue = string | number | boolean | bigint | Date | null;

export interface TestDatabaseClient {
  /** Runs a parameterized statement (`$1`, `$2`, …) and returns its rows; a failure names the statement. */
  query<TRow extends object = Record<string, unknown>>(statement: string, params?: readonly unknown[]): Promise<TRow[]>;
  /** Counts the rows of `table` (`name` or `schema.name`) whose columns equal `where`; every row without it. */
  countRows(table: string, where?: Readonly<Record<string, RowFilterValue>>): Promise<number>;
  /** Ends the pool; later calls do nothing. */
  close(): Promise<void>;
}

/** The part of a node-postgres `Pool` this client uses, typed here so the declarations never name `pg`. */
interface QueryPool {
  query(statement: string, params?: unknown[]): Promise<{ rows: unknown[] }>;
  on(event: "error", listener: () => void): unknown;
  end(): Promise<void>;
}

interface PgModule {
  readonly Pool: new (config: { connectionString: string; max: number }) => QueryPool;
}

const DEFAULT_POOL_SIZE = 2;
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Opens a pool on `url` (`postgres://…`). Throws when the URL is empty or `pg` is not installed; the message never
 * holds the URL, which carries a password. Fits `withDatabase`: `withDatabase(() => createTestDatabaseClient(url), …)`.
 */
export async function createTestDatabaseClient(url: string, options: TestDatabaseClientOptions = {}): Promise<TestDatabaseClient> {
  if (url === "") throw new Error("createTestDatabaseClient: the database URL is empty; pass the integration stack's DATABASE_URL");
  const { Pool } = await importPg();
  const pool = new Pool({ connectionString: url, max: options.max ?? DEFAULT_POOL_SIZE });
  // An idle client that loses its connection emits 'error' on the pool; unhandled, it would crash the test run.
  pool.on("error", () => undefined);
  let closing: Promise<void> | undefined;

  async function query<TRow extends object>(statement: string, params: readonly unknown[] = []): Promise<TRow[]> {
    try {
      const result = await pool.query(statement, [...params]);
      return result.rows as TRow[];
    } catch (error) {
      throw new Error(`Test database query failed: ${statement}`, { cause: error });
    }
  }

  async function countRows(table: string, where: Readonly<Record<string, RowFilterValue>> = {}): Promise<number> {
    const tableName = quoteQualifiedName(table);
    const params: unknown[] = [];
    const conditions = Object.entries(where).map(([column, value]) => {
      const columnName = quoteIdentifier(column);
      if (value === null) return `${columnName} IS NULL`;
      params.push(value);
      return `${columnName} = $${String(params.length)}`;
    });
    const filter = conditions.length === 0 ? "" : ` WHERE ${conditions.join(" AND ")}`;
    const rows = await query<{ count: number }>(`SELECT count(*)::int AS count FROM ${tableName}${filter}`, params);
    return rows[0]?.count ?? 0;
  }

  return {
    query,
    countRows,
    close: () => (closing ??= pool.end()),
  };
}

async function importPg(): Promise<PgModule> {
  try {
    const module = (await import("pg")) as unknown as { default: PgModule };
    return module.default;
  } catch (error) {
    throw new Error("createTestDatabaseClient: the pg package is not installed; add it to the app's devDependencies", { cause: error });
  }
}

function quoteQualifiedName(name: string): string {
  const parts = name.split(".");
  if (parts.length > 2) throw new RangeError(`countRows: "${name}" is not a table name; use name or schema.name`);
  return parts.map(quoteIdentifier).join(".");
}

function quoteIdentifier(name: string): string {
  if (!IDENTIFIER.test(name)) throw new RangeError(`countRows: "${name}" is not a plain identifier (letters, digits, underscore)`);
  return `"${name}"`;
}

// A real Postgres for the rollback tests: PGlite has one connection, so nothing can be written outside an open
// transaction there. `SOFTURE_TEST_POSTGRES_URL` points at a server where the user may create databases (CI's
// postgres:16 service); every call creates its own database, migrates the test app's modules into it and drops it on
// close. The config's `database.handle` is that pool, as an app's would be. Without the variable the tests skip
// locally; in CI they must run (`isPostgresRequired`).
import { randomBytes } from "node:crypto";
import type { ConnectionsContext } from "@softure-ai/connections/server";
import { createFakeOAuthProvider, createTestKeyring, type FakeOAuthProvider, type FakeOAuthProviderOptions } from "@softure-ai/connections/testing";
import type { ConnectionsOptionsInput } from "@softure-ai/connections";
import { createTestClock, type SoftureConfig, type TestClock } from "@softure-ai/core";
import { closeConfiguredDatabases, createDatabase, describeProblem, migrate, type DatabaseHandle } from "@softure-ai/db";
import { sql } from "drizzle-orm";
import { createConfig, NOW } from "./support.js";

export const POSTGRES_ADMIN_URL: string | undefined = process.env.SOFTURE_TEST_POSTGRES_URL || undefined;

/** CI sets `CI`; there a missing Postgres server is a failure, not a skip. */
export const isPostgresRequired: boolean = process.env.CI !== undefined && process.env.CI !== "";

export interface PostgresConnections {
  readonly ctx: ConnectionsContext;
  readonly clock: TestClock;
  readonly config: SoftureConfig;
  readonly fake: FakeOAuthProvider;
  readonly handle: Extract<DatabaseHandle, { kind: "postgres" }>;
  /** Closes the pool and drops the database. */
  readonly close: () => Promise<void>;
}

export interface CreatePostgresConnectionsOptions {
  readonly fake?: FakeOAuthProviderOptions;
  readonly connections?: Omit<ConnectionsOptionsInput, "providers" | "fetch">;
}

async function runAdminStatement(statement: string): Promise<void> {
  if (POSTGRES_ADMIN_URL === undefined) throw new Error("runAdminStatement: SOFTURE_TEST_POSTGRES_URL is not set");
  const admin = await createDatabase(POSTGRES_ADMIN_URL, { max: 1 });
  try {
    await admin.db.execute(sql.raw(statement));
  } finally {
    await admin.close();
  }
}

/** A migrated database of its own on the Postgres server, with the connections test app's modules. */
export async function createPostgresConnections(options: CreatePostgresConnectionsOptions = {}): Promise<PostgresConnections> {
  if (POSTGRES_ADMIN_URL === undefined) throw new Error("createPostgresConnections: SOFTURE_TEST_POSTGRES_URL is not set");
  // Hex only, so it is safe to splice into the statements.
  const name = `softure_connections_${randomBytes(6).toString("hex")}`;
  await runAdminStatement(`CREATE DATABASE ${name}`);
  const drop = () => runAdminStatement(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
  const url = new URL(POSTGRES_ADMIN_URL);
  url.pathname = `/${name}`;
  const fake = createFakeOAuthProvider(options.fake);
  const handle = await createDatabase(url.href, { max: 4 });
  try {
    if (handle.kind !== "postgres") throw new Error("createPostgresConnections: SOFTURE_TEST_POSTGRES_URL is not a Postgres URL");
    const base = createConfig([fake.definition], { ...options.connections, fetch: fake.fetch });
    const config: SoftureConfig = { ...base, database: { url: url.href, handle: () => handle } };
    const migrated = await migrate(handle, { modules: config.modules });
    if (!migrated.ok) throw new Error(`createPostgresConnections: migrations failed:\n${migrated.problems.map(describeProblem).join("\n")}`);
    const clock = createTestClock(NOW);
    return {
      ctx: { db: handle.db, clock, config, env: { ...createTestKeyring(), ...fake.env } },
      clock,
      config,
      fake,
      handle,
      close: async () => {
        await closeConfiguredDatabases();
        await drop();
      },
    };
  } catch (error) {
    await handle.close();
    await drop();
    throw error;
  }
}

/** One stored connection's state columns, read on the pool (what every later caller sees). */
export async function readState(test: PostgresConnections, provider = "fake"): Promise<{ status: string; leaseId: string | null; credentials: string }> {
  const result = await test.handle.pool.query<{ status: string; lease_id: string | null; credentials: string }>(
    "SELECT status, lease_id, credentials FROM connections.accounts WHERE provider = $1 AND account_id = 'default'",
    [provider],
  );
  const [row] = result.rows;
  if (row === undefined) throw new Error(`test: no row for ${provider}`);
  return { status: row.status, leaseId: row.lease_id, credentials: row.credentials };
}

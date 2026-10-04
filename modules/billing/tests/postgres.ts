// A real Postgres for the lock tests: PGlite has one connection, so two transactions there never
// overlap and a race test cannot fail. `SOFTURE_TEST_POSTGRES_URL` points at a server where the user
// may create databases (CI's postgres:16 service); every call creates its own database, migrates
// the billing app's modules into it and drops it on close. Without the variable the tests skip
// locally; in CI they must run (`isPostgresRequired`).
import { randomBytes } from "node:crypto";
import { createTestClock, type SoftureConfig, type TestClock } from "@softure-ai/core";
import { createDatabase, describeProblem, migrate, type DatabaseHandle } from "@softure-ai/db";
import type { BillingContext } from "@softure-ai/billing/server";
import { sql } from "drizzle-orm";
import { createConfig, NOW, type BillingInput } from "./support.js";

export const POSTGRES_ADMIN_URL: string | undefined = process.env.SOFTURE_TEST_POSTGRES_URL || undefined;

/** CI sets `CI`; there a missing Postgres server is a failure, not a skip. */
export const isPostgresRequired: boolean = process.env.CI !== undefined && process.env.CI !== "";

export interface PostgresBilling {
  readonly ctx: BillingContext;
  readonly clock: TestClock;
  readonly config: SoftureConfig;
  /** The app's pool: each concurrent transaction takes its own connection. */
  readonly handle: Extract<DatabaseHandle, { kind: "postgres" }>;
  /** Closes the pool and drops the database. */
  readonly close: () => Promise<void>;
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

/** A migrated database of its own on the Postgres server, with the billing test app's modules. */
export async function createPostgresBilling(options: BillingInput = {}): Promise<PostgresBilling> {
  if (POSTGRES_ADMIN_URL === undefined) throw new Error("createPostgresBilling: SOFTURE_TEST_POSTGRES_URL is not set");
  // Hex only, so it is safe to splice into the statements.
  const name = `softure_billing_${randomBytes(6).toString("hex")}`;
  await runAdminStatement(`CREATE DATABASE ${name}`);
  const drop = () => runAdminStatement(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
  const url = new URL(POSTGRES_ADMIN_URL);
  url.pathname = `/${name}`;
  const config = createConfig(options);
  const handle = await createDatabase(url.href, { max: 6 });
  try {
    if (handle.kind !== "postgres") throw new Error("createPostgresBilling: SOFTURE_TEST_POSTGRES_URL is not a Postgres URL");
    const migrated = await migrate(handle, { modules: config.modules });
    if (!migrated.ok) throw new Error(`createPostgresBilling: migrations failed:\n${migrated.problems.map(describeProblem).join("\n")}`);
    const clock = createTestClock(NOW);
    return {
      ctx: { db: handle.db, clock, config },
      clock,
      config,
      handle,
      close: async () => {
        await handle.close();
        await drop();
      },
    };
  } catch (error) {
    await handle.close();
    await drop();
    throw error;
  }
}

/**
 * A connection of its own that holds locks for a test: `BEGIN` on open, `release` commits and
 * gives the connection back.
 */
export interface Blocker {
  readonly query: (text: string, values?: readonly unknown[]) => Promise<void>;
  readonly release: () => Promise<void>;
}

export async function openBlocker(test: PostgresBilling): Promise<Blocker> {
  const client = await test.handle.pool.connect();
  await client.query("BEGIN");
  let isReleased = false;
  return {
    query: async (text, values) => {
      await client.query(text, values === undefined ? undefined : [...values]);
    },
    release: async () => {
      if (isReleased) return;
      isReleased = true;
      try {
        await client.query("COMMIT");
      } finally {
        client.release();
      }
    },
  };
}

/** How long `waitForLockWaiters` waits before it fails the test. */
const LOCK_WAIT_TIMEOUT_MS = 10_000;
const LOCK_POLL_MS = 20;

/**
 * Resolves once `count` other sessions of the test database wait on a lock; throws after
 * `LOCK_WAIT_TIMEOUT_MS`, naming how many did. A change that takes no lock never waits, so the
 * timeout is how a dropped lock fails the test.
 */
export async function waitForLockWaiters(test: PostgresBilling, count: number): Promise<void> {
  const deadline = Date.now() + LOCK_WAIT_TIMEOUT_MS;
  let waiting = 0;
  while (Date.now() < deadline) {
    const result = await test.handle.pool.query<{ waiting: string }>(
      "SELECT count(*) AS waiting FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock'",
    );
    waiting = Number(result.rows[0]?.waiting ?? 0);
    if (waiting >= count) return;
    await new Promise((resolve) => setTimeout(resolve, LOCK_POLL_MS));
  }
  throw new Error(`waitForLockWaiters: ${String(waiting)} of ${String(count)} sessions waited on a lock after ${String(LOCK_WAIT_TIMEOUT_MS)} ms`);
}

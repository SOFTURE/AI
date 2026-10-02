// Real-Postgres support for the driver-parametrised tests. `SOFTURE_TEST_POSTGRES_URL` points at a
// server where the user may create databases; every test gets its own database and drops it.
// Without the variable the Postgres cases skip locally; CI sets it (`postgres-env.test.ts`).
import { randomBytes } from "node:crypto";
import pg from "pg";

export const POSTGRES_ADMIN_URL: string | undefined = process.env.SOFTURE_TEST_POSTGRES_URL || undefined;

export interface PostgresTestDatabase {
  readonly url: string;
  readonly drop: () => Promise<void>;
}

async function runAdminQuery(text: string): Promise<void> {
  if (POSTGRES_ADMIN_URL === undefined) {
    throw new Error("runAdminQuery: SOFTURE_TEST_POSTGRES_URL is not set");
  }
  const client = new pg.Client({ connectionString: POSTGRES_ADMIN_URL });
  await client.connect();
  try {
    await client.query(text);
  } finally {
    await client.end();
  }
}

/** Creates an empty database with a random name and returns its URL and a drop function. */
export async function createPostgresDatabaseUrl(): Promise<PostgresTestDatabase> {
  if (POSTGRES_ADMIN_URL === undefined) {
    throw new Error("createPostgresDatabaseUrl: SOFTURE_TEST_POSTGRES_URL is not set");
  }
  // Generated from hex only, so it is safe to splice into the statement.
  const name = `softure_test_${randomBytes(6).toString("hex")}`;
  await runAdminQuery(`CREATE DATABASE ${name}`);
  const url = new URL(POSTGRES_ADMIN_URL);
  url.pathname = `/${name}`;
  return { url: url.href, drop: () => runAdminQuery(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`) };
}

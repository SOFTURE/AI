// Shared setup: an app with security, auth, feature-switches, a test module holding user data
// (`notes`), privacy, and an app contributor for an app table (`public.profiles`).
import { auth, AUTH_RATE_LIMIT_BUCKETS } from "@softure-ai/auth";
import { registerUser } from "@softure-ai/auth/server";
import { createTestClock, defineSoftureConfig, err, ok, type ModuleContext, type SoftureConfig, type TestClock } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import { createTestDatabase, type TestDatabase } from "@softure-ai/db/testing";
import { featureSwitches } from "@softure-ai/feature-switches";
import { setSwitch } from "@softure-ai/feature-switches/server";
import { privacy, PRIVACY_RATE_LIMIT_BUCKETS, type PrivacyOptionsInput } from "@softure-ai/privacy";
import type { PrivacyContext } from "@softure-ai/privacy/server";
import { headerIp, security } from "@softure-ai/security";
import { sql } from "drizzle-orm";
import { notes } from "./fixtures/notes.js";

export const NOW = new Date("2026-09-15T12:00:00Z");
export const PASSWORD = "correct horse battery";
export const CLIENT = "ip:192.0.2.10";

/** Set to make the app contributor refuse deletions, as a legal retention rule would. */
export const retention = { isHolding: false };

const db = (context: ModuleContext) => context.db as Queryable;

/** The app's own contributor for `public.profiles`, whose rows reference auth.users without a cascade. */
export const profileContributor = {
  id: "profile",
  exportUserData: async (context: ModuleContext, userId: string) => {
    const result = await db(context).execute<{ display_name: string }>(sql`SELECT display_name FROM public.profiles WHERE user_id = ${userId}`);
    return ok({ displayName: result.rows[0]?.display_name ?? null });
  },
  deleteUserData: async (context: ModuleContext, userId: string) => {
    if (retention.isHolding) return err("profile.retention_hold");
    await db(context).execute(sql`DELETE FROM public.profiles WHERE user_id = ${userId}`);
    return ok();
  },
};

export function createConfig(options: PrivacyOptionsInput = { contributors: [profileContributor] }): SoftureConfig {
  return defineSoftureConfig({
    database: { url: "pglite://" },
    locale: "en",
    timezone: "America/New_York",
    appOrigin: "http://localhost:3000",
    modules: [
      security({ clientIp: headerIp("x-real-ip"), buckets: { ...AUTH_RATE_LIMIT_BUCKETS, ...PRIVACY_RATE_LIMIT_BUCKETS }, cleanupProbability: 0 }),
      auth({ password: { scrypt: { cost: 2 ** 10 } } }),
      featureSwitches({ switches: [{ name: "app.beta", default: false }] }),
      notes(),
      privacy(options),
    ],
  });
}

export interface TestPrivacy {
  readonly ctx: PrivacyContext;
  readonly clock: TestClock;
  readonly database: TestDatabase;
  readonly config: SoftureConfig;
}

export async function createTestPrivacy(config: SoftureConfig = createConfig()): Promise<TestPrivacy> {
  const database = await createTestDatabase(config.modules);
  await database.client.exec(`
    CREATE TABLE public.profiles (
      user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE RESTRICT,
      display_name text NOT NULL
    );
  `);
  const clock = createTestClock(NOW);
  return { ctx: { db: database.db, clock, config }, clock, database, config };
}

export interface SeededUser {
  readonly id: string;
  readonly email: string;
}

/**
 * A user with a row in every table that can hold user data: a session (registration), a role, a
 * pending reset link, a switch they set, a note and a profile.
 */
export async function seedUser(test: TestPrivacy, email: string): Promise<SeededUser> {
  const registered = await registerUser(test.ctx, { email, password: PASSWORD, hasConsented: true, clientKey: CLIENT });
  if (!registered.ok) throw new Error(`seedUser: registration failed with ${registered.error}`);
  const { id } = registered.value.user;
  const client = test.database.client;
  await client.query("INSERT INTO auth.user_roles (user_id, role, granted_at) VALUES ($1, 'admin', $2)", [id, NOW]);
  await client.query("INSERT INTO auth.password_resets (user_id, token_hash, created_at, expires_at) VALUES ($1, $2, $3, $4)", [
    id,
    // A token hash unique per user: the sha256 shape the table accepts.
    id.replaceAll("-", "").padEnd(64, "0"),
    NOW,
    new Date(NOW.getTime() + 60 * 60 * 1000),
  ]);
  const switched = await setSwitch(test.ctx, { name: "app.beta", isEnabled: true, actorId: id });
  if (!switched.ok) throw new Error(`seedUser: setting a switch failed with ${switched.error}`);
  await client.query("INSERT INTO notes.notes (user_id, body) VALUES ($1, $2)", [id, `note of ${email}`]);
  await client.query("INSERT INTO public.profiles (user_id, display_name) VALUES ($1, $2)", [id, `name of ${email}`]);
  return { id, email };
}

/**
 * Every column, in every table of every schema, that holds one of `values` (as text, also inside a
 * longer value), as `schema.table.column`. The scan is how a test proves a deletion left nothing.
 */
export async function findTraces(database: TestDatabase, values: readonly string[]): Promise<string[]> {
  const columns = await database.client.query<{ table_schema: string; table_name: string; column_name: string }>(`
    SELECT c.table_schema, c.table_name, c.column_name
    FROM information_schema.columns c
    JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE t.table_type = 'BASE TABLE'
      AND c.table_schema NOT IN ('information_schema', 'pg_catalog')
      AND c.table_schema NOT LIKE 'pg\\_%'
    ORDER BY 1, 2, 3
  `);
  const found: string[] = [];
  for (const { table_schema: schema, table_name: table, column_name: column } of columns.rows) {
    const [schemaName, tableName, columnName] = [schema, table, column].map((name) => `"${name.replaceAll('"', '""')}"`) as [string, string, string];
    const result = await database.client.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM ${schemaName}.${tableName} AS t
       WHERE EXISTS (SELECT 1 FROM unnest($1::text[]) AS v(value) WHERE strpos(t.${columnName}::text, v.value) > 0)`,
      [values],
    );
    if ((result.rows[0]?.count ?? 0) > 0) found.push(`${schema}.${table}.${column}`);
  }
  return found;
}

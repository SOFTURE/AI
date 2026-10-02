// Shared setup: an app configuration with the security module and a migrated PGlite database.
import { createTestClock, defineSoftureConfig, type SoftureConfig, type TestClock } from "@softure-ai/core";
import { createTestDatabase, type TestDatabase } from "@softure-ai/db/testing";
import { headerIp, security, type SecurityOptionsInput } from "@softure-ai/security";
import type { SecurityContext } from "@softure-ai/security/server";

export const NOW = new Date("2026-09-15T12:00:00Z");
export const MINUTE_MS = 60_000;

/** FIRE_TRACKER's buckets and their 15-minute window. */
export const FIRE_BUCKETS = {
  register: { limit: 5, windowMinutes: 15 },
  login: { limit: 50, windowMinutes: 15 },
  mcp: { limit: 200, windowMinutes: 15 },
  waitlist: { limit: 8, windowMinutes: 15 },
} as const;

export function createConfig(options: Partial<SecurityOptionsInput> = {}): SoftureConfig {
  return defineSoftureConfig({
    database: { url: "pglite://" },
    locale: "en",
    timezone: "Europe/Warsaw",
    appOrigin: "http://localhost:3000",
    modules: [
      security({ clientIp: headerIp("x-real-ip"), buckets: FIRE_BUCKETS, cleanupProbability: 0, ...options }),
    ],
  });
}

export interface TestSecurity {
  readonly ctx: SecurityContext;
  readonly clock: TestClock;
  readonly database: TestDatabase;
}

export async function createTestSecurity(options: Partial<SecurityOptionsInput> = {}): Promise<TestSecurity> {
  const config = createConfig(options);
  const database = await createTestDatabase(config.modules);
  const clock = createTestClock(NOW);
  return { ctx: { db: database.db, clock, config }, clock, database };
}

export async function countRows(database: TestDatabase): Promise<number> {
  const result = await database.client.query<{ count: number }>("SELECT count(*)::int AS count FROM security.rate_limits");
  return result.rows[0]?.count ?? 0;
}

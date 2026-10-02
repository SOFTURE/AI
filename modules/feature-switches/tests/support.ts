// Shared setup: an app configuration with security, auth and feature-switches, and a migrated PGlite database.
import { auth, AUTH_RATE_LIMIT_BUCKETS } from "@softure-ai/auth";
import { createTestClock, defineSoftureConfig, type SoftureConfig, type TestClock } from "@softure-ai/core";
import { createTestDatabase, type TestDatabase } from "@softure-ai/db/testing";
import { featureSwitches, type SwitchDefinitionInput } from "@softure-ai/feature-switches";
import type { SwitchContext } from "@softure-ai/feature-switches/server";
import { headerIp, security } from "@softure-ai/security";

export const NOW = new Date("2026-09-15T12:00:00Z");

/** One switch per default and fail mode combination the tests need. */
export const SWITCHES: SwitchDefinitionInput[] = [
  { name: "billing.checkout_enabled", label: { en: "Checkout", pl: "Kasa" }, description: { en: "Lets users pay." }, default: false },
  { name: "app.beta_banner", default: true, failMode: "open" },
];

export function createConfig(switches: SwitchDefinitionInput[] = SWITCHES, locale: "en" | "pl" = "en"): SoftureConfig {
  return defineSoftureConfig({
    database: { url: "pglite://" },
    locale,
    timezone: "Europe/Warsaw",
    appOrigin: "http://localhost:3000",
    modules: [
      security({ clientIp: headerIp("x-real-ip"), buckets: AUTH_RATE_LIMIT_BUCKETS, cleanupProbability: 0 }),
      auth({ password: { scrypt: { cost: 2 ** 10 } } }),
      featureSwitches({ switches }),
    ],
  });
}

export interface TestSwitches {
  readonly ctx: SwitchContext;
  readonly clock: TestClock;
  readonly database: TestDatabase;
  readonly config: SoftureConfig;
}

export async function createTestSwitches(config: SoftureConfig = createConfig()): Promise<TestSwitches> {
  const database = await createTestDatabase(config.modules);
  const clock = createTestClock(NOW);
  return { ctx: { db: database.db, clock, config }, clock, database, config };
}

/** Every stored row, as `name enabled updated_by`. */
export async function listRows(database: TestDatabase): Promise<string[]> {
  const result = await database.client.query<{ name: string; enabled: boolean; updated_by: string | null }>(
    "SELECT name, enabled, updated_by FROM features.switches ORDER BY name",
  );
  return result.rows.map((row) => `${row.name} ${String(row.enabled)} ${row.updated_by ?? "null"}`);
}

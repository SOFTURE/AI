// Shared setup: an app configuration with the metering module and a migrated PGlite database.
import { createTestClock, defineSoftureConfig, type AnySoftureModule, type SoftureConfig, type TestClock } from "@softure-ai/core";
import { createTestDatabase, type TestDatabase } from "@softure-ai/db/testing";
import { metering, type MeteringOptionsInput } from "@softure-ai/metering";
import type { MeteringContext } from "@softure-ai/metering/server";

/** 14:00 in Warsaw (CEST), a Thursday in the middle of October. */
export const NOW = new Date("2026-10-15T12:00:00Z");

export const OPTIONS: MeteringOptionsInput = {
  providers: [
    { id: "elevenlabs", unit: "credits", budgets: [{ period: "month", limit: 1000 }, { period: "day", limit: 100, perAccount: true }] },
    { id: "openrouter", unit: "usd", budgets: [{ period: "day", limit: 0.3 }] },
    { id: "search", unit: "requests" },
    { id: "speech", unit: "seconds", budgets: [{ period: "day", limit: 60 }] },
  ],
};

export function createConfig(options: MeteringOptionsInput = OPTIONS, extra: readonly AnySoftureModule[] = [], timezone = "Europe/Warsaw"): SoftureConfig {
  return defineSoftureConfig({
    database: { url: "pglite://" },
    locale: "en",
    timezone,
    appOrigin: "http://localhost:3000",
    modules: [metering(options), ...extra],
  });
}

export interface TestMetering {
  readonly ctx: MeteringContext;
  readonly clock: TestClock;
  readonly database: TestDatabase;
}

export async function createTestMetering(config: SoftureConfig = createConfig()): Promise<TestMetering> {
  const database = await createTestDatabase(config.modules);
  const clock = createTestClock(NOW);
  return { ctx: { db: database.db, clock, config }, clock, database };
}

/** Every stored row, oldest first, as `provider status amount account step`. */
export async function listRows(database: TestDatabase): Promise<string[]> {
  const result = await database.client.query<{ provider: string; status: string; amount: string; account_id: string | null; step: string | null }>(
    "SELECT provider, status, amount::text AS amount, account_id, step FROM metering.charges ORDER BY created_at, provider, amount",
  );
  return result.rows.map((row) => `${row.provider} ${row.status} ${String(Number(row.amount))} ${row.account_id ?? "-"} ${row.step ?? "-"}`);
}

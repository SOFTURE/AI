// Shared setup: an app on https://app.example.com with the analytics module and its options, and a
// funnel on a migrated PGlite database for the counter's tests.
import { analytics, type AnalyticsOptionsInput } from "@softure-ai/analytics";
import type { AnalyticsContext } from "@softure-ai/analytics/server";
import { createTestClock, defineSoftureConfig, type SoftureConfig, type TestClock } from "@softure-ai/core";
import { createTestDatabase, type TestDatabase } from "@softure-ai/db/testing";

export const APP_ORIGIN = "https://app.example.com";

/** 10:00 in Warsaw on 2026-10-03. */
export const NOW = new Date("2026-10-03T08:00:00Z");

/** A landing pixel, two wizard beacons and a sign-up counted on the server. */
export const FUNNEL_STEPS = [
  { id: "landing", via: "pixel" },
  { id: "pricing", via: "beacon" },
  { id: "checkout", via: "beacon" },
  { id: "signup", via: "server" },
] as const;

export function createConfig(options: AnalyticsOptionsInput = {}): SoftureConfig {
  return defineSoftureConfig({ database: { url: "pglite://" }, locale: "en", timezone: "Europe/Warsaw", appOrigin: APP_ORIGIN, modules: [analytics(options)] });
}

export interface TestFunnel {
  readonly ctx: AnalyticsContext;
  readonly clock: TestClock;
  readonly database: TestDatabase;
}

export async function createTestFunnel(options: AnalyticsOptionsInput = { funnel: { steps: [...FUNNEL_STEPS] } }): Promise<TestFunnel> {
  const config = createConfig(options);
  const database = await createTestDatabase(config.modules);
  const clock = createTestClock(NOW);
  return { ctx: { db: database.db, clock, config }, clock, database };
}

export interface CountRow {
  day: string;
  channel: string;
  step: string;
  count: number;
}

/** Every counter, ordered by day, channel and step. */
export async function listCounts(funnel: TestFunnel): Promise<CountRow[]> {
  const result = await funnel.database.client.query<{ day: Date | string; channel: string; step: string; count: string | number }>(
    "SELECT to_char(day, 'YYYY-MM-DD') AS day, channel, step, count FROM analytics.funnel_counts ORDER BY day, channel, step",
  );
  return result.rows.map((row) => ({ day: String(row.day), channel: row.channel, step: row.step, count: Number(row.count) }));
}

/** A request as the browser sends it; `navigate` adds `Sec-Fetch-Mode: navigate`. */
export function createRequest(
  url: string,
  init: { referer?: string; navigate?: boolean; rsc?: boolean; nextUrl?: string; destination?: string; method?: string } = {},
): Request {
  const headers = new Headers();
  if (init.referer !== undefined) headers.set("referer", init.referer);
  if (init.navigate ?? true) headers.set("sec-fetch-mode", "navigate");
  if (init.rsc === true) {
    headers.set("sec-fetch-mode", "cors");
    headers.set("rsc", "1");
  }
  if (init.nextUrl !== undefined) {
    // What Next.js leaves of a client navigation once it stripped its flight headers.
    headers.set("sec-fetch-mode", "cors");
    headers.set("next-url", init.nextUrl);
  }
  if (init.destination !== undefined) headers.set("sec-fetch-dest", init.destination);
  return new Request(new URL(url, APP_ORIGIN), { method: init.method ?? "GET", headers });
}

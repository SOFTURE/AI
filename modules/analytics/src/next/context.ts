// What the adapter hands the server functions: the registered config, the process-wide database
// handle and the wall clock.
import { systemClock, type SoftureConfig } from "@softure-ai/core";
import { getSoftureConfig } from "@softure-ai/core/next";
import { getConfiguredDatabase } from "@softure-ai/db";
import type { AnalyticsContext } from "../server/funnel.js";

export async function getAnalyticsContext(config: SoftureConfig = getSoftureConfig()): Promise<AnalyticsContext> {
  if (config.database === null) {
    throw new Error("@softure-ai/analytics: softure.config.ts has no database; the funnel needs one");
  }
  const { db } = await getConfiguredDatabase(config.database);
  return { db, clock: systemClock, config };
}

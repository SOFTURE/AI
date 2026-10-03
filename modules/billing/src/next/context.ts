// What the adapter hands the server functions: the registered config, the process-wide database
// handle and the wall clock.
import { systemClock, type SoftureConfig } from "@softure-ai/core";
import { getSoftureConfig } from "@softure-ai/core/next";
import { getSharedDatabase } from "@softure-ai/db";
import type { BillingContext } from "../server/entitlements.js";

export async function getBillingContext(config: SoftureConfig = getSoftureConfig()): Promise<BillingContext> {
  if (config.database === null) {
    // Unreachable for a validated config: the module has a database schema.
    throw new Error("@softure-ai/billing: softure.config.ts has no database; billing needs one");
  }
  const { db } = await getSharedDatabase(config.database.url);
  return { db, clock: systemClock, config };
}

// What the adapter hands the server functions: the registered config, the process-wide database
// handle and the wall clock. Every billing request comes through here, so a broken setup (an
// undeclared `adminRole`) fails on the first one.
import { systemClock, type SoftureConfig } from "@softure-ai/core";
import { getSoftureConfig } from "@softure-ai/core/next";
import { getConfiguredDatabase } from "@softure-ai/db";
import type { BillingContext } from "../server/entitlements.js";
import { assertAdminRoleDeclared } from "../server/setup.js";

export async function getBillingContext(config: SoftureConfig = getSoftureConfig()): Promise<BillingContext> {
  assertAdminRoleDeclared(config);
  if (config.database === null) {
    // Unreachable for a validated config: the module has a database schema.
    throw new Error("@softure-ai/billing: softure.config.ts has no database; billing needs one");
  }
  const { db } = await getConfiguredDatabase(config.database);
  return { db, clock: systemClock, config };
}

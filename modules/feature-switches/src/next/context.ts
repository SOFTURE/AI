// What the adapter hands the server functions: the registered config, the process-wide database
// handle and the wall clock.
import { systemClock, type SoftureConfig } from "@softure-ai/core";
import { getSoftureConfig } from "@softure-ai/core/next";
import { getSharedDatabase } from "@softure-ai/db";
import type { SwitchContext } from "../server/switches.js";

export async function getSwitchContext(config: SoftureConfig = getSoftureConfig()): Promise<SwitchContext> {
  if (config.database === null) {
    throw new Error("@softure-ai/feature-switches: softure.config.ts has no database; feature-switches needs one");
  }
  const { db } = await getSharedDatabase(config.database.url);
  return { db, clock: systemClock, config };
}

// What the adapter hands the server functions: the registered config, the process-wide database handle and the
// wall clock.
import { systemClock, type SoftureConfig } from "@softure-ai/core";
import { getSoftureConfig } from "@softure-ai/core/next";
import { getConfiguredDatabase } from "@softure-ai/db";
import type { JobsContext } from "../server/context.js";

export async function getJobsContext(config: SoftureConfig = getSoftureConfig()): Promise<JobsContext> {
  if (config.database === null) {
    throw new Error("@softure-ai/jobs: softure.config.ts has no database; jobs needs one");
  }
  const { db } = await getConfiguredDatabase(config.database);
  return { db, clock: systemClock, config };
}

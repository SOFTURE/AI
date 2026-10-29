// What the adapter hands the server functions: the registered config, the process-wide database handle and the
// wall clock. The link keyring comes from `process.env`.
import { systemClock, type SoftureConfig } from "@softure-ai/core";
import { getSoftureConfig } from "@softure-ai/core/next";
import { getConfiguredDatabase } from "@softure-ai/db";
import type { FilesContext } from "../server/context.js";

export async function getFilesContext(config: SoftureConfig = getSoftureConfig()): Promise<FilesContext> {
  if (config.database === null) {
    throw new Error("@softure-ai/files: softure.config.ts has no database; files needs one");
  }
  const { db } = await getConfiguredDatabase(config.database);
  return { db, clock: systemClock, config };
}

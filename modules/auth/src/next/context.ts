// What the adapter hands the server functions: the registered config, the process-wide database
// handle and the wall clock. Request scope (cookies, headers) stays in this folder.
import { systemClock, type SoftureConfig } from "@softure-ai/core";
import { getSoftureConfig } from "@softure-ai/core/next";
import { getSharedDatabase } from "@softure-ai/db";
import type { AuthContext } from "../server/sessions.js";

export async function getAuthContext(config: SoftureConfig = getSoftureConfig()): Promise<AuthContext> {
  if (config.database === null) {
    throw new Error("@softure-ai/auth: softure.config.ts has no database; auth needs one");
  }
  const { db } = await getSharedDatabase(config.database.url);
  return { db, clock: systemClock, config };
}

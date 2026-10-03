// What the adapter hands the server functions: the registered config, the process-wide database
// handle and the wall clock.
import { systemClock, type SoftureConfig } from "@softure-ai/core";
import { getSoftureConfig } from "@softure-ai/core/next";
import { getSharedDatabase } from "@softure-ai/db";
import type { McpAccessContext } from "../server/tokens.js";

export async function getMcpAccessContext(config: SoftureConfig = getSoftureConfig()): Promise<McpAccessContext> {
  if (config.database === null) {
    throw new Error("@softure-ai/mcp-access: softure.config.ts has no database; mcp-access needs one");
  }
  const { db } = await getSharedDatabase(config.database.url);
  return { db, clock: systemClock, config };
}

// The module context (`{ db, clock, config }`) from the configuration: the process-wide database
// handle and the wall clock. For apps that compose their own routes from `/server`; the `/next`
// adapter builds its context with it.
import { systemClock, type SoftureConfig } from "@softure-ai/core";
import { getConfiguredDatabase } from "@softure-ai/db";
import type { McpAccessContext } from "./tokens.js";

export async function createMcpAccessContext(config: SoftureConfig): Promise<McpAccessContext> {
  if (config.database === null) {
    throw new Error("@softure-ai/mcp-access: softure.config.ts has no database; mcp-access needs one");
  }
  const { db } = await getConfiguredDatabase(config.database);
  return { db, clock: systemClock, config };
}

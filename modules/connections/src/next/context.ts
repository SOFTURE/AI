// What the adapter hands the server functions: the registered config, the process-wide database handle and
// the wall clock. The keyring and client secrets come from `process.env`.
import { systemClock, type SoftureConfig } from "@softure-ai/core";
import { getSoftureConfig } from "@softure-ai/core/next";
import { getConfiguredDatabase } from "@softure-ai/db";
import type { ConnectionsContext } from "../server/store.js";

export async function getConnectionsContext(config: SoftureConfig = getSoftureConfig()): Promise<ConnectionsContext> {
  if (config.database === null) {
    throw new Error("@softure-ai/connections: softure.config.ts has no database; connections needs one");
  }
  const { db } = await getConfiguredDatabase(config.database);
  return { db, clock: systemClock, config };
}

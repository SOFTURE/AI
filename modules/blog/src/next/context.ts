// What the adapter hands the store: the registered config, the process-wide database handle and the
// wall clock; and what it hands the components (`getPageContext`, shared with `/server`).
import { systemClock, type SoftureConfig } from "@softure-ai/core";
import { getSoftureConfig } from "@softure-ai/core/next";
import { getConfiguredDatabase } from "@softure-ai/db";
import type { BlogContext } from "../db/articles.js";

export async function getBlogContext(config: SoftureConfig = getSoftureConfig()): Promise<BlogContext> {
  if (config.database === null) {
    // Unreachable for a validated config: the module has a database schema.
    throw new Error("@softure-ai/blog: softure.config.ts has no database; the blog needs one");
  }
  const { db } = await getConfiguredDatabase(config.database);
  return { db, clock: systemClock, config };
}

export { getPageContext } from "../server/page-context.js";

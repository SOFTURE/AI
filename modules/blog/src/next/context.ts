// What the adapter hands the store: the registered config, the process-wide database handle and the
// wall clock; and what it hands the components: the copy, paths, brand and disclaimer.
import { systemClock, type SoftureConfig } from "@softure-ai/core";
import { getSoftureConfig } from "@softure-ai/core/next";
import { getConfiguredDatabase } from "@softure-ai/db";
import type { BlogContext } from "../db/articles.js";
import { getBlogMessages, getBlogOptions, getBlogRoutes } from "../server/options.js";
import type { BlogPageContext } from "../ui/page-context.js";

export async function getBlogContext(config: SoftureConfig = getSoftureConfig()): Promise<BlogContext> {
  if (config.database === null) {
    // Unreachable for a validated config: the module has a database schema.
    throw new Error("@softure-ai/blog: softure.config.ts has no database; the blog needs one");
  }
  const { db } = await getConfiguredDatabase(config.database);
  return { db, clock: systemClock, config };
}

export function getPageContext(config: SoftureConfig): BlogPageContext {
  const options = getBlogOptions(config);
  const routes = getBlogRoutes(config);
  return {
    messages: getBlogMessages(config),
    locale: config.locale,
    routes,
    methodPath: options.methodPage ? routes.method : null,
    brand: options.brand?.name ?? null,
    disclaimer: options.disclaimer === undefined ? null : (options.disclaimer[config.locale] ?? options.disclaimer.en),
  };
}

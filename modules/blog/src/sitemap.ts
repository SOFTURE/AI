// The sitemap contributor for `@softure-ai/seo`, in the root entry because `softure.config.ts` imports
// it. That file also loads in plain Node and in bundles made outside Next (`softure migrate`, the blog
// command, a container's migrate script), so nothing here may reach `next/*`: the entries come from
// one query on the shared database, not from the pages' Next cache. Crawlers read a sitemap rarely.
import { systemClock, type SoftureConfig } from "@softure-ai/core";
import { getSoftureConfig } from "@softure-ai/core/next";
import { getSharedDatabase } from "@softure-ai/db";
import { listArticles } from "./db/articles.js";
import { getBlogSitemapEntries, type BlogSitemapEntry } from "./discovery/sitemap.js";
import { getBlogOptions, getBlogRoutes } from "./server/options.js";

/** The listing, the articles, the glossary, its terms and the method page, each dated by its last content change. */
export async function readBlogSitemap(config: SoftureConfig): Promise<BlogSitemapEntry[]> {
  if (config.database === null) {
    // Unreachable for a validated config: the module has a database schema.
    throw new Error("@softure-ai/blog: softure.config.ts has no database; the blog sitemap needs one");
  }
  const { db } = await getSharedDatabase(config.database.url);
  const texts = await listArticles({ db, clock: systemClock, config });
  const routes = getBlogRoutes(config);
  return getBlogSitemapEntries({
    articles: texts.filter((text) => text.kind === "article"),
    terms: texts.filter((text) => text.kind === "term"),
    routes,
    methodPath: getBlogOptions(config).methodPage ? routes.method : null,
  });
}

/**
 * `seo({ sitemap: { contributors: [blogSitemap()] } })`. The config is read when the sitemap is
 * requested (it is still being defined when this is called); pass one to read another. A failed read
 * throws; seo logs it and serves the rest. Mount `app/sitemap.ts` with `dynamic = "force-dynamic"`.
 */
export function blogSitemap(config?: SoftureConfig): () => Promise<BlogSitemapEntry[]> {
  return () => readBlogSitemap(config ?? getSoftureConfig());
}

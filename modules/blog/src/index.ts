// Public API of @softure-ai/blog: the module factory for softure.config.ts, its options, the content
// contract and the tables. Parsing article files, the store, the publish run and the read functions
// are in `@softure-ai/blog/server`, the `softure-blog` command in `/cli`.
import { defineModule, resolveMigrationsDir } from "@softure-ai/core";
import { blogMessages } from "./messages/index.js";
import { BLOG_REFRESH_RATE_LIMIT_BUCKET, BLOG_REFRESH_SECRET_ENV } from "./discovery/refresh.js";
import { blogOptionsSchema } from "./options.js";
import { checkArticlesTable } from "./server/health.js";

export const MODULE_ID = "blog";

/**
 * The rate limit bucket of the cache refresh route (`refreshBlogCache`), to spread into
 * `security({ buckets })`: requests per client address, counted before the secret is checked. A
 * publish sends one; the limit leaves room for a few retries and stops guessing.
 */
export const BLOG_RATE_LIMIT_BUCKETS = {
  [BLOG_REFRESH_RATE_LIMIT_BUCKET]: { limit: 10, windowMinutes: 15 },
} as const;

/**
 * Enables the blog in `softure.config.ts`: `blog()`, or with options
 * `blog({ brand: { name: "Example" }, methodPage: true, fields: z.object({ scenario: z.string().optional() }) })`.
 * Pages mount under `routes` (`index` `/blog`, `glossary` `/blog/glossary`, `method` `/blog/how-we-write`,
 * `rss` `/blog/rss.xml`). With `seo()` listed too, `blogSitemap()` feeds its sitemap and a publish pings IndexNow.
 * With `security()` listed and `refreshBlogCache` mounted at `refresh` (`/api/blog/refresh`), a publish from
 * the command refreshes the running app's cache.
 */
export const blog = defineModule({
  manifest: {
    id: MODULE_ID,
    version: "0.1.6",
    // seo is optional: with it the sitemap lists the texts and a publish pings IndexNow. security is
    // optional too: only the cache refresh route needs it, for its rate limit.
    dependsOn: { seo: "^0.1.0?", security: "^0.1.0?" },
    dbSchema: "blog",
    tables: ["articles", "slug_history"],
    env: [
      {
        name: BLOG_REFRESH_SECRET_ENV,
        required: false,
        description:
          "Shared secret (at least 32 characters) of the cache refresh route refreshBlogCache, set for the running app and for softure-blog publish; without it a publish shows after revalidateSeconds.",
      },
    ],
    switches: [],
    routes: { index: "/blog", glossary: "/blog/glossary", method: "/blog/how-we-write", rss: "/blog/rss.xml", refresh: "/api/blog/refresh" },
    mount: [
      { kind: "page", path: "app/blog/page.tsx", export: "BlogIndexPage" },
      { kind: "page", path: "app/blog/[slug]/page.tsx", export: "BlogArticlePage" },
      { kind: "route-handler", path: "app/blog/[slug]/opengraph-image.tsx", export: "BlogArticleOgImage" },
      { kind: "page", path: "app/blog/glossary/page.tsx", export: "GlossaryIndexPage" },
      { kind: "page", path: "app/blog/glossary/[slug]/page.tsx", export: "GlossaryTermPage" },
      { kind: "page", path: "app/blog/how-we-write/page.tsx", export: "BlogMethodPage" },
      { kind: "route-handler", path: "app/blog/rss.xml/route.ts", export: "serveBlogRss" },
      { kind: "route-handler", path: "app/api/blog/refresh/route.ts", export: "refreshBlogCache" },
      { kind: "middleware", path: "proxy.ts", export: "createBlogRedirects" },
    ],
    privacy: { exports: false, deletes: false },
  },
  messages: blogMessages,
  options: blogOptionsSchema,
  migrations: { dir: resolveMigrationsDir(import.meta.url, "../migrations/") },
  health: checkArticlesTable,
});

export {
  BLOG_ARTICLE_KINDS,
  BLOG_ARTICLE_STATUSES,
  type BlogArticle,
  type BlogArticleContent,
  type BlogArticleInput,
  type BlogArticleKind,
  type BlogArticleState,
  type BlogArticleStatus,
  type BlogFaqEntry,
  type BlogFields,
  type BlogPublishAction,
  type BlogPublishResult,
  type BlogSlugErrorCode,
  type BlogSource,
} from "./contract.js";
export { blogMessages, type BlogMessages } from "./messages/index.js";
export {
  DEFAULT_CONTENT_DIR,
  DEFAULT_REVALIDATE_SECONDS,
  FRONTMATTER_KEYS,
  type BlogFieldsParseResult,
  type BlogFieldsSchema,
  type BlogOptions,
  type BlogOptionsInput,
  type BlogSkillSection,
  type LocalizedText,
} from "./options.js";
export { articles, blogSchema, slugHistory } from "./db/schema.js";
export type { BlogSitemapEntry } from "./discovery/sitemap.js";
export { blogSitemap, readBlogSitemap } from "./sitemap.js";
/** Builds a voice phrase for `blog({ quality: { voice: { phrases } } })` in the config. */
export { wordPattern } from "./quality/text.js";

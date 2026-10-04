// Public API of @softure-ai/blog: the module factory for softure.config.ts, its options, the content
// contract and the tables. Parsing article files, the store, the publish run and the read functions
// are in `@softure-ai/blog/server`, the `softure-blog` command in `/cli`.
import { defineModule, resolveMigrationsDir } from "@softure-ai/core";
import { blogMessages } from "./messages/index.js";
import { blogOptionsSchema } from "./options.js";
import { checkArticlesTable } from "./server/health.js";

export const MODULE_ID = "blog";

/**
 * Enables the blog in `softure.config.ts`: `blog()`, or with options
 * `blog({ brand: { name: "Example" }, methodPage: true, fields: z.object({ scenario: z.string().optional() }) })`.
 * Pages mount under `routes` (`index` `/blog`, `glossary` `/blog/glossary`, `method` `/blog/how-we-write`).
 */
export const blog = defineModule({
  manifest: {
    id: MODULE_ID,
    version: "0.0.0",
    dependsOn: {},
    dbSchema: "blog",
    tables: ["articles", "slug_history"],
    env: [],
    switches: [],
    routes: { index: "/blog", glossary: "/blog/glossary", method: "/blog/how-we-write" },
    mount: [
      { kind: "page", path: "app/blog/page.tsx", export: "BlogIndexPage" },
      { kind: "page", path: "app/blog/[slug]/page.tsx", export: "BlogArticlePage" },
      { kind: "route-handler", path: "app/blog/[slug]/opengraph-image.tsx", export: "BlogArticleOgImage" },
      { kind: "page", path: "app/blog/glossary/page.tsx", export: "GlossaryIndexPage" },
      { kind: "page", path: "app/blog/glossary/[slug]/page.tsx", export: "GlossaryTermPage" },
      { kind: "page", path: "app/blog/how-we-write/page.tsx", export: "BlogMethodPage" },
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
  type LocalizedText,
} from "./options.js";
export { articles, blogSchema, slugHistory } from "./db/schema.js";

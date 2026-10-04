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
 * `blog({ contentDir: "content/blog", reservedSlugs: ["glossary"], fields: z.object({ scenario: z.string().optional() }) })`.
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
    routes: {},
    mount: [],
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
  FRONTMATTER_KEYS,
  type BlogFieldsParseResult,
  type BlogFieldsSchema,
  type BlogOptions,
  type BlogOptionsInput,
} from "./options.js";
export { articles, blogSchema, slugHistory } from "./db/schema.js";
/** Builds a voice phrase for `blog({ quality: { voice: { phrases } } })` in the config. */
export { wordPattern } from "./quality/text.js";

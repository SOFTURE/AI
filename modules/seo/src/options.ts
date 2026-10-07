// The options an app passes to `seo({ ... })` in softure.config.ts, parsed at startup.
import { z } from "zod";
import type { SitemapContributor, SitemapEntry } from "./sitemap.js";

const PATH_HINT = "must be a path starting with a single /";
const ORIGIN_HINT = "must be an http(s) origin without a path, e.g. https://example.com";
// indexnow.org: 8 to 128 characters, letters, digits and dashes.
export const INDEXNOW_KEY_PATTERN = /^[a-zA-Z0-9-]{8,128}$/;
const CRAWLER_TOKEN = /^[A-Za-z0-9][A-Za-z0-9 ._-]*$/;
const CRAWLER_TOKEN_HINT = "is not a robots.txt token: letters, digits, space, . _ and -";
// RFC 9309 §2.2: a field name is a token; the module writes these four itself.
const DIRECTIVE_NAME = /^[A-Za-z][A-Za-z0-9-]*$/;
const DIRECTIVE_NAME_HINT = "is not a robots.txt field name: a letter, then letters, digits and -";
const MODULE_DIRECTIVES = new Set(["user-agent", "allow", "disallow", "sitemap"]);
const MODULE_DIRECTIVE_HINT = "is written by the module itself; set it through robots.allow, robots.disallow or the crawler categories";
// Next writes values verbatim, so a line break would add lines of its own to robots.txt.
const DIRECTIVE_VALUE_HINT = "must be a non-empty value on one line (no CR or LF)";
const CONTRIBUTOR_HINT = "must be a function (context) => SitemapEntry[] | Promise<SitemapEntry[]>";

const pathSchema = z.string().refine((path) => path.startsWith("/") && !path.startsWith("//"), PATH_HINT);

const directiveValueSchema = z.string().refine((value) => value.trim() !== "" && !/[\r\n]/.test(value), DIRECTIVE_VALUE_HINT);

const directivesSchema = z
  .record(z.string(), z.union([directiveValueSchema, z.array(directiveValueSchema).min(1, "must list at least one value")]))
  .superRefine((directives, context) => {
    for (const name of Object.keys(directives)) {
      if (!DIRECTIVE_NAME.test(name)) {
        context.addIssue({ code: "custom", path: [name], message: DIRECTIVE_NAME_HINT });
      } else if (MODULE_DIRECTIVES.has(name.toLowerCase())) {
        context.addIssue({ code: "custom", path: [name], message: MODULE_DIRECTIVE_HINT });
      }
    }
    // Names are checked even when a value failed, so one start-up lists every problem.
  }, { when: (payload) => typeof payload.value === "object" && payload.value !== null });

const crawlerCategorySchema = z
  .strictObject({
    /** `false` closes the whole site to this category with a named `Disallow: /` group. */
    enabled: z.boolean().default(true),
    /** More robots.txt tokens for this category, e.g. a new provider's bot. */
    extra: z.array(z.string().regex(CRAWLER_TOKEN, CRAWLER_TOKEN_HINT)).default([]),
  })
  .prefault({});

const sitemapEntrySchema = z.strictObject({
  path: pathSchema,
  /** When the content last changed. Leave it out rather than guess: no date beats a false one. */
  lastModified: z.date().optional(),
  changeFrequency: z.enum(["always", "hourly", "daily", "weekly", "monthly", "yearly", "never"]).optional(),
  priority: z.number().min(0).max(1).optional(),
});

export const seoOptionsSchema = z.strictObject({
  /** The public site's origin when it is not the config's `appOrigin` (e.g. the apex of an `app.` host). */
  origin: z.string().refine(isOrigin, ORIGIN_HINT).optional(),
  canonical: z
    .strictObject({
      /** `apex` drops a leading `www.`, `www` adds it, `as-is` keeps the origin's host. */
      host: z.enum(["as-is", "apex", "www"]).default("as-is"),
      /** `true` ends every canonical path but the root with `/`; `false` strips it. */
      trailingSlash: z.boolean().default(false),
    })
    .prefault({}),
  robots: z
    .strictObject({
      /** Paths open to crawlers. `/` next to a disallowed `/` is written `/$`: the root only. */
      allow: z.array(pathSchema).default(["/"]),
      /** Private paths, closed to every crawler, named or not. */
      disallow: z.array(pathSchema).default([]),
      /**
       * More lines for every group, e.g. `{ "Content-Signal": "ai-train=yes, search=yes" }`. Every group
       * gets them, since a crawler with a group of its own reads only that group.
       */
      other: directivesSchema.default({}),
    })
    .prefault({}),
  crawlers: z
    .strictObject({
      search: crawlerCategorySchema,
      onDemand: crawlerCategorySchema,
      training: crawlerCategorySchema,
    })
    .prefault({}),
  sitemap: z
    .strictObject({
      /** The app's own pages. */
      entries: z.array(sitemapEntrySchema).default([]),
      /** Functions that list more pages at request time, e.g. a blog's published articles. */
      contributors: z
        .array(z.custom<SitemapContributor>((value) => typeof value === "function", CONTRIBUTOR_HINT))
        .default([]),
    })
    .prefault({}),
  indexNow: z
    .strictObject({
      /** Public by protocol: search engines read it from the key file to verify the host. */
      key: z.string().regex(INDEXNOW_KEY_PATTERN, "must be 8 to 128 letters, digits or dashes (IndexNow key format)"),
    })
    .optional(),
});

export type SeoOptionsInput = z.input<typeof seoOptionsSchema>;
export type SeoOptions = z.output<typeof seoOptionsSchema>;
export type { SitemapEntry };

function isOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && url.origin === value;
  } catch {
    return false;
  }
}

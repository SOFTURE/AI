// The options an app passes to `blog({ ... })` in softure.config.ts, parsed at startup.
import { z } from "zod";
import { qualitySettingSchema } from "./quality/options.js";

/** Where the app keeps its article files unless a command names a path. */
export const DEFAULT_CONTENT_DIR = "content/blog";

/** The frontmatter keys of the module; the app's `fields` may not reuse them. */
export const FRONTMATTER_KEYS = [
  "id",
  "slug",
  "kind",
  "cluster",
  "pillar",
  "title",
  "description",
  "summary",
  "status",
  "current_as_of",
  "published_at",
  "sources",
  "faq",
  "forms",
] as const;

/** What a schema's `safeParse` reports; zod 3 and 4 both fit. */
export type BlogFieldsParseResult =
  | { readonly success: true; readonly data: unknown }
  | { readonly success: false; readonly error: { readonly issues: readonly { readonly path: readonly PropertyKey[]; readonly message: string }[] } };

/**
 * The app's own frontmatter fields: an object schema from the app's `zod`, e.g.
 * `z.object({ scenario: z.string().optional() })`. Its keys join the frontmatter; the parsed value
 * is stored with the article and enters its content hash. It must parse to plain JSON values.
 */
export interface BlogFieldsSchema {
  readonly shape: Readonly<Record<string, unknown>>;
  readonly safeParse: (value: unknown) => BlogFieldsParseResult;
}

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function isFieldsSchema(value: unknown): value is BlogFieldsSchema {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { shape?: unknown; safeParse?: unknown };
  return typeof candidate.shape === "object" && candidate.shape !== null && typeof candidate.safeParse === "function";
}

export const blogOptionsSchema = z
  .strictObject({
    /** The folder with the article files, relative to the app's root. */
    contentDir: z.string().trim().min(1).default(DEFAULT_CONTENT_DIR),
    /**
     * Slugs taken by static pages under the blog's path (a glossary index, a method page). A static
     * route wins over the article route, so an article with such a slug would be unreachable.
     */
    reservedSlugs: z.array(z.string().max(100).regex(KEBAB, "must be kebab-case, e.g. how-we-write")).default([]),
    fields: z.custom<BlogFieldsSchema>(isFieldsSchema, "must be an object schema, e.g. z.object({ scenario: z.string() })").optional(),
    /** The text quality gate (`softure-blog check`, and every publish); `false` turns it off. */
    quality: qualitySettingSchema,
  })
  .superRefine((options, ctx) => {
    for (const key of Object.keys(options.fields?.shape ?? {})) {
      if ((FRONTMATTER_KEYS as readonly string[]).includes(key)) {
        ctx.addIssue({ code: "custom", path: ["fields", key], message: `"${key}" is a frontmatter key of the module` });
      }
    }
  });

export type BlogOptionsInput = z.input<typeof blogOptionsSchema>;
export type BlogOptions = z.output<typeof blogOptionsSchema>;

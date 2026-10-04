// The options an app passes to `blog({ ... })` in softure.config.ts, parsed at startup.
import { z } from "zod";
import type { BlockPlugin } from "./render/render-article.js";

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

function isBlockPlugin(value: unknown): value is BlockPlugin {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { type?: unknown; render?: unknown };
  return typeof candidate.type === "string" && KEBAB.test(candidate.type) && typeof candidate.render === "function";
}

/** How long the pages cache their reads by default, in seconds; the app's `revalidate` should match. */
export const DEFAULT_REVALIDATE_SECONDS = 300;

/** Text the app writes per locale; `en` is the fallback for a locale it leaves out. */
const localizedTextSchema = z.strictObject({
  en: z.string().trim().min(1),
  pl: z.string().trim().min(1).optional(),
});

export type LocalizedText = z.output<typeof localizedTextSchema>;

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const colorSchema = z.string().regex(HEX_COLOR, "must be a six-digit hex colour, e.g. #0c0c0d");
const HOSTNAME = /^(?=.{1,253}$)[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/;

const brandSchema = z.strictObject({
  /** The site's name: in page titles, as the author and publisher in JSON-LD, on the OG card. */
  name: z.string().trim().min(1).max(80),
  /** The OG card's colours; each defaults to the dark scheme of @softure-ai/ui's default theme. */
  colors: z
    .strictObject({ background: colorSchema.optional(), foreground: colorSchema.optional(), accent: colorSchema.optional() })
    .optional(),
});

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
    /** The site's brand for titles, JSON-LD and the OG card; without it pages carry no brand. */
    brand: brandSchema.optional(),
    /** Whether the app mounts the "how our texts are made" page (`BlogMethodPage` at `routes.method`). */
    methodPage: z.boolean().default(false),
    /** A note under every text (not advice, not a recommendation…); none by default. */
    disclaimer: localizedTextSchema.optional(),
    /** Display names of clusters by key; a cluster without one shows its key with spaces. */
    clusters: z.record(z.string().regex(KEBAB, "must be kebab-case, e.g. investing-basics"), localizedTextSchema).default({}),
    /** Block plugins for the app's fenced blocks (`renderArticle({ blocks })`), used by the pages. */
    blocks: z.array(z.custom<BlockPlugin>(isBlockPlugin, "must be a block plugin: { type: \"chart\", render(block) }")).default([]),
    /** Hosts besides the `appOrigin` host whose links are not marked external (subdomains included). */
    siteHosts: z.array(z.string().regex(HOSTNAME, "must be a host name, e.g. example.com")).default([]),
    /** How long the listing and glossary cache their reads; keep it equal to the pages' `revalidate`. */
    revalidateSeconds: z.number().int().min(1).default(DEFAULT_REVALIDATE_SECONDS),
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

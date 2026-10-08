// The options an app passes to `blog({ ... })` in softure.config.ts, parsed at startup.
import { z } from "zod";
import { qualitySettingSchema } from "./quality/options.js";
import type { GonePageRenderInput } from "./pages/redirects.js";
import type { ArticleImagePolicy } from "./render/images.js";
import { EXTERNAL_LINK_MARKERS, type BlockPlugin } from "./render/render-article.js";

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
  const candidate = value as { type?: unknown; syntax?: unknown; render?: unknown; markdown?: unknown };
  return (
    typeof candidate.type === "string" && KEBAB.test(candidate.type) && typeof candidate.render === "function" &&
    (candidate.syntax === undefined || candidate.syntax === "fence" || candidate.syntax === "directive") &&
    (candidate.markdown === undefined || typeof candidate.markdown === "function")
  );
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

/** The weights Satori (`next/og`) draws: static fonts only, in steps of 100. */
export const OG_FONT_WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900] as const;

export type OgFontWeight = (typeof OG_FONT_WEIGHTS)[number];

const WOFF2 = /\.woff2$/i;

/** The part of a font source that names the file: a URL's path, or the path as written. */
function getSourceFileName(src: string): string {
  return src.startsWith("https://") ? new URL(src).pathname : src;
}

function isFontSource(src: string): boolean {
  if (src.startsWith("https://")) return URL.canParse(src);
  return !/^[a-z][a-z0-9+.-]*:\/\//i.test(src);
}

const ogFontSchema = z.strictObject({
  /** The family name the card writes in; a second file of one weight and style needs its own name. */
  name: z.string().trim().min(1).max(80),
  weight: z
    .custom<OgFontWeight>((value) => OG_FONT_WEIGHTS.some((weight) => weight === value), "must be a weight from 100 to 900 in steps of 100")
    .default(400),
  style: z.enum(["normal", "italic"]).default("normal"),
  /** A .ttf, .otf or .woff file: an https URL, an absolute path, or a path from the app's root. */
  src: z
    .string()
    .trim()
    .min(1)
    .refine(isFontSource, "must be an https URL or a file path, e.g. fonts/inter-700.woff")
    .refine((src) => !isFontSource(src) || !WOFF2.test(getSourceFileName(src)), "must be a .ttf, .otf or .woff file; the card cannot read .woff2"),
});

export type OgFontSource = z.output<typeof ogFontSchema>;

const brandSchema = z.strictObject({
  /** The site's name: in page titles, as the author and publisher in JSON-LD, on the OG card. */
  name: z.string().trim().min(1).max(80),
  /** The OG card's colours; each defaults to the dark scheme of @softure-ai/ui's default theme. */
  colors: z
    .strictObject({ background: colorSchema.optional(), foreground: colorSchema.optional(), accent: colorSchema.optional() })
    .optional(),
  /**
   * The OG card's fonts, read by the card's route on its first render and kept for the life of the
   * process; without them the card uses `next/og`'s default font.
   */
  fonts: z
    .array(ogFontSchema)
    .min(1, "must list at least one font")
    .superRefine((fonts, ctx) => {
      const seen = new Set<string>();
      for (const [index, font] of fonts.entries()) {
        const key = `"${font.name}" ${font.weight} ${font.style}`;
        if (seen.has(key)) {
          ctx.addIssue({ code: "custom", path: [index], message: `${key} is listed twice; give a second file its own name, e.g. "${font.name} Ext"` });
        }
        seen.add(key);
      }
    })
    .optional(),
});

/** Whether a Markdown body holds a `#` or `##` heading outside fenced code. */
function hasTopHeading(body: string): boolean {
  let fence: string | null = null;
  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.trimStart();
    const marker = trimmed.startsWith("```") ? "```" : trimmed.startsWith("~~~") ? "~~~" : null;
    if (marker !== null) fence = fence === null ? marker : fence === marker ? null : fence;
    else if (fence === null && /^ {0,3}#{1,2}(?:[ \t]|$)/.test(line)) return true;
  }
  return false;
}

/** One section of the app's own in the writing skill: `## <title>` and the Markdown body, verbatim. */
const skillSectionSchema = z.strictObject({
  title: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .refine((title) => !/[\r\n]/.test(title), "must be one line"),
  body: z
    .string()
    .trim()
    .min(1)
    .refine((body) => !hasTopHeading(body), "must not hold a # or ## heading; use ### and deeper (the title is the section's ## heading)"),
});

/** A 410 link: a path from the site root or an https URL, never another scheme. */
const goneHrefSchema = z
  .string()
  .trim()
  .refine((href) => (href.startsWith("/") && !href.startsWith("//")) || (href.startsWith("https://") && URL.canParse(href)), "must be a path from the site root or an https URL, e.g. /calculator");

const gonePageSchema = z.strictObject({
  /** Further ways on, listed under the link to the listing. */
  links: z.array(z.strictObject({ href: goneHrefSchema, label: localizedTextSchema })).max(5).default([]),
  /**
   * `(input) => html`: the whole body of the 410, written by the app (its own HTML, trusted like a
   * block plugin's; the proxy still answers 410 with `text/html`). `input.links` holds the labels in
   * the app's locale.
   */
  render: z.custom<(input: GonePageRenderInput) => string>((value) => typeof value === "function", "must be a function: (input) => html").optional(),
});

const skillSchema = z.strictObject({
  /** The app's own sections (its numbers, block plugins, fields), written to `references/app.md` of the skill. */
  sections: z.array(skillSectionSchema).superRefine((sections, ctx) => {
    const seen = new Set<string>();
    for (const [index, section] of sections.entries()) {
      if (seen.has(section.title)) ctx.addIssue({ code: "custom", path: [index, "title"], message: `"${section.title}" is the title of another section` });
      seen.add(section.title);
    }
  }).default([]),
});

export type BlogSkillSection = z.output<typeof skillSectionSchema>;

const imagePolicySchema = z.strictObject({
  /** Hosts whose https images are allowed besides the site's own paths (subdomains included). */
  hosts: z.array(z.string().regex(HOSTNAME, "must be a host name, e.g. cdn.example.com")).readonly().default([]),
  /** `(src) => ({ width, height })` in pixels, or `null` for an unknown image. */
  dimensions: z.custom<ArticleImagePolicy["dimensions"]>((value) => typeof value === "function", "must be a function: (src) => ({ width, height }) or null"),
});

/** A URL fragment or HTML id part, without `#`: a JSON-LD node id or the cluster anchor prefix. */
const fragmentSchema = z
  .string()
  .max(40)
  .regex(/^[A-Za-z][A-Za-z0-9_-]*$/, "must be a letter followed by letters, digits, - or _, without #, e.g. article");

const jsonLdSchema = z.strictObject({
  /** The `@id` fragments of the nodes: `<url>#<article>`, `<url>#<term>`, `<glossary url>#<glossary>`. */
  ids: z
    .strictObject({ article: fragmentSchema.default("article"), term: fragmentSchema.default("term"), glossary: fragmentSchema.default("glossary") })
    .default({ article: "article", term: "term", glossary: "glossary" }),
});

const anchorsSchema = z.strictObject({
  /** A cluster's section on the listing is `<cluster>-<key>`, the breadcrumb of its articles points there. */
  cluster: fragmentSchema.default("cluster"),
});

/** The Open Graph locale of a language when the app sets none: `og:locale` is `language_TERRITORY`. */
export const DEFAULT_OPEN_GRAPH_LOCALES = { en: "en_US", pl: "pl_PL" } as const;

const localeTagsSchema = z.strictObject({
  /** The content's language as a BCP-47 tag: JSON-LD `inLanguage` and the feed's `<language>`; the bare code by default. */
  bcp47: z
    .string()
    .regex(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/, "must be a BCP-47 tag, e.g. pl-PL")
    .optional(),
  /** `og:locale` (`language_TERRITORY`); `en_US` or `pl_PL` by default. */
  openGraph: z
    .string()
    .regex(/^[a-z]{2,3}_[A-Z]{2}$/, "must be an Open Graph locale (language_TERRITORY), e.g. pl_PL")
    .optional(),
});

export type BlogLocaleTagsInput = z.output<typeof localeTagsSchema>;

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
    /** Hosts besides those of `appOrigin` and the canonical site origin (`getSiteUrls`) whose links are not marked external (subdomains included). */
    siteHosts: z.array(z.string().regex(HOSTNAME, "must be a host name, e.g. example.com")).default([]),
    /**
     * What the pages append to an external link (`renderArticle({ externalMarker })`): the arrow and a
     * visually hidden "opens in a new tab", the hidden words only, or nothing.
     */
    externalLinkMarker: z.enum(EXTERNAL_LINK_MARKERS).default("icon-and-text"),
    /**
     * Which images article bodies may show (`renderArticle({ images })`), used by the pages and the
     * quality gate; without it every image renders as its alt text and the gate refuses it.
     */
    images: imagePolicySchema.optional(),
    /** The JSON-LD node ids; an app that already published other fragments keeps them here. */
    jsonLd: jsonLdSchema.default({ ids: { article: "article", term: "term", glossary: "glossary" } }),
    /** The anchors the pages write; an app whose listing already used another prefix keeps it here. */
    anchors: anchorsSchema.default({ cluster: "cluster" }),
    /** The language tags per app locale: BCP-47 for the content, Open Graph for `og:locale`. */
    locales: z.strictObject({ en: localeTagsSchema.optional(), pl: localeTagsSchema.optional() }).default({}),
    /** The page a withdrawn text answers with (410): extra links, or the app's own body. */
    gonePage: gonePageSchema.default({ links: [] }),
    /** How long the listing and glossary cache their reads; keep it equal to the pages' `revalidate`. */
    revalidateSeconds: z.number().int().min(1).default(DEFAULT_REVALIDATE_SECONDS),
    /** The text quality gate (`softure-blog check`, and every publish); `false` turns it off. */
    quality: qualitySettingSchema,
    /** What `softure-blog skill install` adds to the generated writing skill. */
    skill: skillSchema.default({ sections: [] }),
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

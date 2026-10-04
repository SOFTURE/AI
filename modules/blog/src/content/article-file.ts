// An article file `<slug>.md` → the input of `publishArticle` (FIRE_TRACKER `src/lib/blog-article-file.ts`).
// A YAML frontmatter between `---` lines, then the Markdown body. The frontmatter is strict: an
// unknown key is an error, so a typo in `current_as_of` cannot pass as a missing date. The app's
// own keys (`blog({ fields })`) are checked by its schema.
import { createHash } from "node:crypto";
import { basename } from "node:path";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import { BLOG_ARTICLE_KINDS, BLOG_ARTICLE_STATUSES, type BlogArticleContent, type BlogArticleInput, type BlogFields } from "../contract.js";
import { FRONTMATTER_KEYS, type BlogFieldsSchema } from "../options.js";

export interface ParseArticleFileOptions {
  /** Slugs taken by static pages (`blog({ reservedSlugs })`). */
  readonly reservedSlugs?: readonly string[];
  /** The app's own frontmatter fields (`blog({ fields })`). */
  readonly fields?: BlogFieldsSchema;
}

export type ArticleFileResult = { readonly ok: true; readonly article: BlogArticleInput } | { readonly ok: false; readonly errors: readonly string[] };

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const FENCE = "---";

const kebab = () => z.string().max(100).regex(KEBAB, "lowercase letters, digits and single hyphens, e.g. index-funds-basics");
const httpUrl = z.url({ protocol: /^https?$/, error: "must be an http(s) address" });

const frontmatterSchema = z.strictObject({
  id: kebab(),
  slug: kebab(),
  kind: z.enum(BLOG_ARTICLE_KINDS).default("article"),
  cluster: kebab().optional(),
  /** The main text of its cluster: other texts of the cluster always recommend it. Needs `cluster`. */
  pillar: z.boolean().default(false),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(320),
  /** The "in short" box above the body: a few sentences an AI assistant can quote. */
  summary: z.string().trim().min(1).max(600).optional(),
  status: z.enum(BLOG_ARTICLE_STATUSES),
  current_as_of: z.iso.date(),
  /** A day (`YYYY-MM-DD`, read as midnight UTC) or a moment with an offset. */
  published_at: z.union([z.iso.date(), z.iso.datetime({ offset: true })]).optional(),
  sources: z.array(z.strictObject({ name: z.string().trim().min(1), url: httpUrl })).default([]),
  faq: z.array(z.strictObject({ question: z.string().trim().min(1), answer: z.string().trim().min(1) })).default([]),
  /** Only for a term: the phrases, as they stand in texts, that link to its definition. */
  forms: z.array(z.string().trim().min(2).max(80)).optional(),
});

/**
 * Reads an article file. `fileName` is a path or a bare name; it must read `<slug>.md`, so the file
 * and the address cannot drift apart.
 */
export function parseArticleFile(text: string, fileName: string, options: ParseArticleFileOptions = {}): ArticleFileResult {
  const parts = splitFrontmatter(text);
  if (parts === null) return { ok: false, errors: ["no frontmatter: the file starts with a --- line, the metadata, then a --- line"] };

  let raw: unknown;
  try {
    raw = parseYaml(parts.frontmatter);
  } catch (error) {
    return { ok: false, errors: [`the frontmatter is not valid YAML: ${error instanceof Error ? error.message : String(error)}`] };
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return { ok: false, errors: ["the frontmatter must be a YAML mapping of keys to values"] };

  const { core, fields: fieldsInput } = splitKeys(raw as Record<string, unknown>, options.fields);
  const errors: string[] = [];
  const parsed = frontmatterSchema.safeParse(core);
  if (!parsed.success) errors.push(...parsed.error.issues.map((issue) => `${formatPath(issue.path)}: ${issue.message}`));
  const fields = parseFields(fieldsInput, options.fields, errors);
  if (!parsed.success || fields === null) return { ok: false, errors };

  const meta = parsed.data;
  const bodyMarkdown = parts.body.trim();
  if (bodyMarkdown === "") errors.push("the body under the frontmatter is empty");
  if (meta.pillar && meta.cluster === undefined) errors.push("pillar: true needs a cluster; a pillar is the main text of one topic");
  if (options.reservedSlugs?.includes(meta.slug) === true) errors.push(`slug ${meta.slug} is taken by a static page of the blog; choose another`);
  if (meta.kind === "term" && (meta.forms === undefined || meta.forms.length === 0)) errors.push("forms: a term needs at least one form, or no article links to it");
  if (meta.kind === "article" && meta.forms !== undefined) errors.push("forms: only for kind: term; an article is not a link target");
  if (basename(fileName) !== `${meta.slug}.md`) errors.push(`the file name ${basename(fileName)} differs from the slug plus .md (${meta.slug}.md)`);
  if (errors.length > 0) return { ok: false, errors };

  const content: BlogArticleContent = {
    kind: meta.kind,
    cluster: meta.cluster ?? null,
    title: meta.title,
    description: meta.description,
    summary: meta.summary ?? null,
    bodyMarkdown,
    currentAsOf: meta.current_as_of,
    sources: meta.sources,
    faq: meta.faq,
    termForms: meta.forms ?? [],
    fields,
  };
  return {
    ok: true,
    article: {
      id: meta.id,
      slug: meta.slug,
      status: meta.status,
      publishedAt: readPublishedAt(meta.published_at),
      isPillar: meta.pillar,
      ...content,
      contentSha256: computeContentHash(content),
    },
  };
}

/**
 * The hash of what a reader sees, without status, slug, publication date and pillar: it moves
 * `updated_at`. A fixed array, so the order of keys in the file does not change it. Fields added
 * later join only when present, so the hash of an existing text does not change with the format.
 */
export function computeContentHash(content: BlogArticleContent): string {
  const canonical = JSON.stringify([
    content.kind,
    content.cluster,
    content.title,
    content.description,
    content.summary,
    content.bodyMarkdown,
    content.currentAsOf,
    content.sources.map((source) => [source.name, source.url]),
    content.faq.map((entry) => [entry.question, entry.answer]),
    ...(content.termForms.length > 0 ? [content.termForms] : []),
    ...(Object.keys(content.fields).length > 0 ? [sortKeys(content.fields)] : []),
  ]);
  return createHash("sha256").update(canonical).digest("hex");
}

function splitFrontmatter(text: string): { frontmatter: string; body: string } | null {
  const lines = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").split("\n");
  if (lines[0] !== FENCE) return null;
  const end = lines.indexOf(FENCE, 1);
  if (end === -1) return null;
  return { frontmatter: lines.slice(1, end).join("\n"), body: lines.slice(end + 1).join("\n") };
}

/** The module's keys and unknown keys go to the strict schema (which names the unknown ones); the app's keys to its schema. */
function splitKeys(raw: Record<string, unknown>, fields: BlogFieldsSchema | undefined): { core: Record<string, unknown>; fields: Record<string, unknown> } {
  const appKeys = new Set(Object.keys(fields?.shape ?? {}).filter((key) => !(FRONTMATTER_KEYS as readonly string[]).includes(key)));
  const core: Record<string, unknown> = {};
  const app: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (appKeys.has(key)) app[key] = value;
    else core[key] = value;
  }
  return { core, fields: app };
}

function parseFields(input: Record<string, unknown>, schema: BlogFieldsSchema | undefined, errors: string[]): BlogFields | null {
  if (schema === undefined) return {};
  const result = schema.safeParse(input);
  if (!result.success) {
    errors.push(...result.error.issues.map((issue) => `${formatPath(issue.path)}: ${issue.message}`));
    return null;
  }
  const data = result.data;
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    errors.push("the app's fields schema must parse to an object");
    return null;
  }
  // Undefined optional fields are not stored: an absent key and a missing one read the same.
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
}

function readPublishedAt(value: string | undefined): Date | null {
  if (value === undefined) return null;
  return new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
}

function formatPath(path: readonly PropertyKey[]): string {
  return path.length === 0 ? "frontmatter" : path.map(String).join(".");
}

/** A copy with object keys sorted at every level, so the hash does not depend on key order. */
function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, sortKeys((value as Record<string, unknown>)[key])]),
  );
}

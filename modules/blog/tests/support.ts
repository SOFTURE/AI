// Shared setup: an app with the blog module on a fresh PGlite database, a test clock, and article
// files built from a frontmatter object.
import { createTestClock, defineSoftureConfig, type SoftureConfig, type TestClock } from "@softure-ai/core";
import { createTestDatabase, type TestDatabase } from "@softure-ai/db/testing";
import { blog, type BlogOptionsInput } from "@softure-ai/blog";
import type { BlogArticle } from "@softure-ai/blog";
import type { ArticleFile, BlogContext } from "@softure-ai/blog/server";
import { stringify } from "yaml";

export const NOW = new Date("2026-10-04T08:00:00Z");

export function createConfig(options: BlogOptionsInput = {}): SoftureConfig {
  return defineSoftureConfig({
    database: { url: "pglite://" },
    locale: "en",
    timezone: "UTC",
    appOrigin: "https://app.example.com",
    modules: [blog(options)],
  });
}

export interface TestBlog {
  readonly ctx: BlogContext;
  readonly clock: TestClock;
  readonly database: TestDatabase;
  readonly config: SoftureConfig;
}

export async function createTestBlog(options: BlogOptionsInput = {}): Promise<TestBlog> {
  const config = createConfig(options);
  const database = await createTestDatabase(config.modules);
  const clock = createTestClock(NOW);
  return { ctx: { db: database.db, clock, config }, clock, database, config };
}

/** A complete, valid frontmatter of a published article; tests override keys. */
export function buildFrontmatter(overrides: Readonly<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: "index-funds",
    slug: "index-funds",
    title: "Index funds in plain words",
    description: "What an index fund is and what it costs.",
    status: "published",
    current_as_of: "2026-10-01",
    sources: [{ name: "Fund factsheet", url: "https://example.com/factsheet" }],
    faq: [{ question: "Is it safe?", answer: "It follows the market, up and down." }],
    ...overrides,
  };
}

/** The text of an article file; keys set to `undefined` are left out. */
export function buildArticleText(overrides: Readonly<Record<string, unknown>> = {}, body = "An index fund buys the whole market.\n\n## Costs\n\nLow fees."): string {
  const frontmatter = Object.fromEntries(Object.entries(buildFrontmatter(overrides)).filter(([, value]) => value !== undefined));
  return `---\n${stringify(frontmatter)}---\n\n${body}\n`;
}

/** An article file named after its slug. */
export function buildArticleFile(overrides: Readonly<Record<string, unknown>> = {}, body?: string): ArticleFile {
  const slug = (overrides.slug as string | undefined) ?? "index-funds";
  return { name: `${slug}.md`, text: buildArticleText(overrides, body) };
}

/** A stored, published article row for page tests; tests override fields. */
export function buildStoredArticle(overrides: Partial<BlogArticle> = {}): BlogArticle {
  return {
    id: "index-funds",
    slug: "index-funds",
    kind: "article",
    cluster: "investing-basics",
    isPillar: false,
    title: "Index funds in plain words",
    description: "What an index fund is and what it costs.",
    summary: null,
    bodyMarkdown: "An index fund buys the whole market.",
    status: "published",
    currentAsOf: "2026-10-01",
    // 22:30 UTC on 14 September is 00:30 on 15 September in Warsaw.
    publishedAt: new Date("2026-09-14T22:30:00Z"),
    updatedAt: null,
    sources: [{ name: "Fund factsheet", url: "https://example.com/factsheet" }],
    faq: [],
    termForms: [],
    fields: {},
    contentSha256: "a".repeat(64),
    createdAt: new Date("2026-09-14T22:30:00Z"),
    ...overrides,
  };
}

/** A stored, published glossary term. */
export function buildStoredTerm(overrides: Partial<BlogArticle> = {}): BlogArticle {
  return buildStoredArticle({
    id: "expense-ratio",
    slug: "expense-ratio",
    kind: "term",
    cluster: null,
    title: "Expense ratio",
    description: "The yearly cost of a fund as a share of the money in it.",
    bodyMarkdown: "The expense ratio is the yearly cost of a fund.",
    termForms: ["expense ratio"],
    ...overrides,
  });
}

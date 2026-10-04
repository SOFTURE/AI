// Shared setup: an app with the blog module on a fresh PGlite database, a test clock, and article
// files built from a frontmatter object.
import { createTestClock, defineSoftureConfig, type SoftureConfig, type TestClock } from "@softure-ai/core";
import { createTestDatabase, type TestDatabase } from "@softure-ai/db/testing";
import { blog, type BlogOptionsInput } from "@softure-ai/blog";
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

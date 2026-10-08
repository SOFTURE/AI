// Moving a blog in: the first publish of an article takes its dates and old slugs from the app's own
// history, so readers and crawlers see the same dates and every old address still answers 301.
import { findArticleBySlug, findSlugRedirect, parseArticleHistory, runBlogPublish, type ArticleHistoryMap } from "@softure-ai/blog/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildArticleFile, createTestBlog, type TestBlog } from "./support.js";

let test: TestBlog;

beforeEach(async () => {
  test = await createTestBlog();
});
afterEach(async () => {
  await test.database.close();
});

function history(input: unknown): ArticleHistoryMap {
  const parsed = parseArticleHistory(input);
  if (!parsed.ok) throw new Error(parsed.errors.join("; "));
  return parsed.history;
}

const FILE = buildArticleFile({ published_at: undefined });
const HISTORY = history({
  articles: [
    {
      id: "index-funds",
      published_at: "2026-03-01T08:00:00+01:00",
      updated_at: "2026-06-15T10:30:00Z",
      old_slugs: [{ slug: "what-is-an-index-fund", changed_at: "2026-04-01T00:00:00Z" }, { slug: "index-fund" }],
    },
  ],
});

describe("history on the first publish", () => {
  it("keeps the dates, writes the old slugs and reports the import", async () => {
    const run = await runBlogPublish(test.ctx, [FILE], { commit: true, history: HISTORY });
    expect(run).toMatchObject({ status: "done", warnings: [] });
    expect(run.status === "done" && run.changes[0]?.imported).toEqual({ publishedAt: new Date("2026-03-01T07:00:00Z"), oldSlugs: 2 });
    expect(await findArticleBySlug(test.ctx, "index-funds")).toMatchObject({
      publishedAt: new Date("2026-03-01T07:00:00Z"),
      updatedAt: new Date("2026-06-15T10:30:00Z"),
    });
    expect(await findSlugRedirect(test.ctx, "what-is-an-index-fund")).toBe("index-funds");
    expect(await findSlugRedirect(test.ctx, "index-fund")).toBe("index-funds");
    const changedAt = await test.database.client.query<{ old_slug: string; changed_at: Date }>("SELECT old_slug, changed_at FROM blog.slug_history ORDER BY old_slug");
    expect(changedAt.rows).toEqual([
      { old_slug: "index-fund", changed_at: test.clock.now() },
      { old_slug: "what-is-an-index-fund", changed_at: new Date("2026-04-01T00:00:00Z") },
    ]);
  });

  it("keeps the timestamps to the microsecond, as the history gives them", async () => {
    const precise = history({
      articles: [
        {
          id: "index-funds",
          published_at: "2026-03-01T08:00:12.421579+01:00",
          updated_at: "2026-06-15T10:30:00.000001Z",
          old_slugs: [{ slug: "what-is-an-index-fund", changed_at: "2026-04-01T00:00:00.123456Z" }],
        },
      ],
    });
    expect(precise.get("index-funds")).toEqual({
      publishedAt: "2026-03-01T08:00:12.421579+01:00",
      updatedAt: "2026-06-15T10:30:00.000001Z",
      oldSlugs: [{ slug: "what-is-an-index-fund", changedAt: "2026-04-01T00:00:00.123456Z" }],
    });
    const run = await runBlogPublish(test.ctx, [FILE], { commit: true, history: precise });
    expect(run).toMatchObject({ status: "done" });
    // Compared in SQL: a Date (milliseconds) could not tell the two apart, and the session's time zone stays out of it.
    const rows = await test.database.client.query<{ published: boolean; updated: boolean; changed: boolean; micros: number }>(
      `SELECT a.published_at = '2026-03-01T07:00:12.421579Z'::timestamptz AS published,
              a.updated_at = '2026-06-15T10:30:00.000001Z'::timestamptz AS updated,
              h.changed_at = '2026-04-01T00:00:00.123456Z'::timestamptz AS changed,
              extract(microseconds FROM a.published_at)::int AS micros
         FROM blog.articles a JOIN blog.slug_history h ON h.article_id = a.id`,
    );
    expect(rows.rows).toEqual([{ published: true, updated: true, changed: true, micros: 12_421_579 }]);
    const again = await runBlogPublish(test.ctx, [FILE], { commit: true, history: precise });
    expect(again.status === "done" && again.changes.map((change) => change.action)).toEqual(["unchanged"]);
  });

  it("is unchanged on a second run with the same history, and ignores history for an existing row", async () => {
    await runBlogPublish(test.ctx, [FILE], { commit: true, history: HISTORY });
    const again = await runBlogPublish(test.ctx, [FILE], { commit: true, history: HISTORY });
    expect(again.status === "done" && again.changes.map((change) => [change.action, change.imported])).toEqual([["unchanged", undefined]]);

    const other = await createTestBlog();
    try {
      await runBlogPublish(other.ctx, [FILE], { commit: true });
      const late = await runBlogPublish(other.ctx, [FILE], { commit: true, history: HISTORY });
      expect(late.status === "done" && late.changes[0]?.action).toBe("unchanged");
      expect(await findSlugRedirect(other.ctx, "index-fund")).toBeNull();
    } finally {
      await other.database.close();
    }
  });

  it("lets the file's own published_at win", async () => {
    await runBlogPublish(test.ctx, [buildArticleFile({ published_at: "2026-01-10" })], { commit: true, history: HISTORY });
    expect((await findArticleBySlug(test.ctx, "index-funds"))?.publishedAt).toEqual(new Date("2026-01-10T00:00:00Z"));
  });

  it("refuses an old slug another article holds, as its slug or in its history", async () => {
    await runBlogPublish(test.ctx, [buildArticleFile({ id: "other", slug: "index-fund", title: "Other" })], { commit: true });
    expect(await runBlogPublish(test.ctx, [FILE], { commit: true, history: HISTORY })).toEqual({
      status: "refused",
      problems: [{ subject: "index-funds", message: "old slug index-fund (history) is the slug of article other (blog.slug_taken)" }],
      warnings: [],
    });
    expect(await findArticleBySlug(test.ctx, "index-funds")).toBeNull();
  });

  it("warns about an entry for an article outside the run", async () => {
    const run = await runBlogPublish(test.ctx, [FILE], { history: history({ articles: [{ id: "bonds", published_at: null }] }) });
    expect(run).toMatchObject({ status: "done", warnings: [{ subject: "bonds", message: "the history names an article that is not in this run; it is applied when its file is published" }] });
  });
});

describe("parseArticleHistory", () => {
  it("names the field of every problem", () => {
    expect(
      parseArticleHistory({
        articles: [
          { id: "Bad Id", published_at: "yesterday" },
          { id: "a", published_at: null, updated_at: "2026-01-01T00:00:00Z" },
          { id: "b", published_at: null, old_slugs: [{ slug: "x" }] },
          { id: "c", published_at: null, old_slugs: [{ slug: "x" }], extra: 1 },
        ],
      }),
    ).toEqual({
      ok: false,
      errors: [
        "articles.0.id: must be a kebab-case article id",
        "articles.0.published_at: must be an ISO 8601 timestamp with a time zone, e.g. 2026-09-01T08:00:00Z",
        "articles.1.updated_at: updated_at needs published_at: a text is updated only after it was published",
        'articles.3: Unrecognized key: "extra"',
        'articles.3.old_slugs.0.slug: "x" is an old slug twice',
      ],
    });
    expect(parseArticleHistory({ articles: [{ id: "a", published_at: null }, { id: "a", published_at: null }] })).toEqual({ ok: false, errors: ['articles.1.id: "a" is listed twice'] });
    expect(parseArticleHistory([])).toMatchObject({ ok: false });
  });
});

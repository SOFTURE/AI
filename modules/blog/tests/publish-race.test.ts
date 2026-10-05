// Two publishes racing for one slug, on a real Postgres (tests/postgres.ts). A blocker connection
// plays the run that writes first: it holds the new slug in an open transaction, so the run under
// test reads the slug as free, writes, and waits on the unique index until the blocker commits.
// The interleaving is the same on every run: the race happens, it is not hoped for.
import { findArticleBySlug, runBlogPublish } from "@softure-ai/blog/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createPostgresBlog, isPostgresRequired, openBlocker, POSTGRES_ADMIN_URL, waitForLockWaiters, type Blocker, type PostgresBlog } from "./postgres.js";
import { buildArticleFile, NOW } from "./support.js";

describe("the Postgres server for the blog's race tests", () => {
  it.runIf(isPostgresRequired)("is configured in CI", () => {
    expect(POSTGRES_ADMIN_URL).toMatch(/^postgres(ql)?:\/\//);
  });
});

describe.skipIf(POSTGRES_ADMIN_URL === undefined)("a publish run that loses a slug race", () => {
  let test: PostgresBlog;
  let blocker: Blocker | undefined;

  beforeEach(async () => {
    test = await createPostgresBlog();
  });
  afterEach(async () => {
    await blocker?.release();
    blocker = undefined;
    await test.close();
  });

  /** The other run's article, written but not committed: it holds `slug` in the unique index. */
  async function holdSlug(id: string, slug: string): Promise<Blocker> {
    const held = await openBlocker(test);
    await held.query(
      `INSERT INTO blog.articles (id, slug, kind, title, description, body_markdown, status, current_as_of, published_at, content_sha256, created_at)
       VALUES ($1, $2, 'article', 'Held', 'Held by the other run.', 'Body.', 'published', '2026-10-01', $3, $4, $3)`,
      [id, slug, NOW, "b".repeat(64)],
    );
    return held;
  }

  async function readSlugHistory(): Promise<{ old_slug: string; article_id: string }[]> {
    const result = await test.handle.pool.query<{ old_slug: string; article_id: string }>("SELECT old_slug, article_id FROM blog.slug_history ORDER BY old_slug");
    return result.rows;
  }

  it("reports a taken slug when a new article's insert loses, and writes nothing", async () => {
    blocker = await holdSlug("other-run", "index-funds");
    const run = runBlogPublish(test.ctx, [buildArticleFile({ id: "bonds", slug: "bonds", title: "Bonds" }), buildArticleFile()], { commit: true });
    await waitForLockWaiters(test, 1);
    await blocker.release();

    expect(await run).toEqual({
      status: "refused",
      problems: [{ subject: "index-funds", message: "slug index-funds is the slug of article other-run (blog.slug_taken)" }],
      warnings: [],
    });
    expect(await findArticleBySlug(test.ctx, "bonds")).toBeNull();
    expect(await findArticleBySlug(test.ctx, "index-funds")).toMatchObject({ id: "other-run" });
  });

  it("reports a taken slug when a renamed article's update loses, and keeps the old slug", async () => {
    await runBlogPublish(test.ctx, [buildArticleFile({ id: "bonds", slug: "bonds", title: "Bonds" })], { commit: true });
    blocker = await holdSlug("other-run", "bonds-explained");
    const run = runBlogPublish(test.ctx, [buildArticleFile({ id: "bonds", slug: "bonds-explained", title: "Bonds" })], { commit: true });
    await waitForLockWaiters(test, 1);
    await blocker.release();

    expect(await run).toEqual({
      status: "refused",
      problems: [{ subject: "bonds", message: "slug bonds-explained is the slug of article other-run (blog.slug_taken)" }],
      warnings: [],
    });
    expect(await findArticleBySlug(test.ctx, "bonds")).toMatchObject({ id: "bonds" });
    expect(await readSlugHistory()).toEqual([]);
  });

  it("reports the race in a dry run too", async () => {
    blocker = await holdSlug("other-run", "index-funds");
    const run = runBlogPublish(test.ctx, [buildArticleFile()]);
    await waitForLockWaiters(test, 1);
    await blocker.release();

    expect(await run).toMatchObject({ status: "refused", problems: [{ subject: "index-funds", message: "slug index-funds is the slug of article other-run (blog.slug_taken)" }] });
  });

  it("publishes when the other run rolls back", async () => {
    const held = await holdSlug("other-run", "index-funds");
    const run = runBlogPublish(test.ctx, [buildArticleFile()], { commit: true });
    await waitForLockWaiters(test, 1);
    await held.query("ROLLBACK");
    await held.release();

    expect(await run).toMatchObject({ status: "done", committed: true, changes: [{ id: "index-funds", action: "added" }] });
    expect(await findArticleBySlug(test.ctx, "index-funds")).toMatchObject({ id: "index-funds" });
  });
});

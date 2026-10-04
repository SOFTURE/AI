// The article store on PGlite (FIRE_TRACKER `src/db/blog.test.ts`) and the constraints of migration 0001.
import type { BlogArticleInput } from "@softure-ai/blog";
import { findArticleBySlug, findSlugRedirect, getPublishedArticle, listArticles, parseArticleFile, publishArticle } from "@softure-ai/blog/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildArticleText, createTestBlog, NOW, type TestBlog } from "./support.js";

const LATER = new Date("2026-10-05T09:00:00Z");

function buildInput(overrides: Readonly<Record<string, unknown>> = {}, body?: string): BlogArticleInput {
  const slug = (overrides.slug as string | undefined) ?? "index-funds";
  const result = parseArticleFile(buildArticleText(overrides, body), `${slug}.md`);
  if (!result.ok) throw new Error(result.errors.join("; "));
  return result.article;
}

let test: TestBlog;

beforeEach(async () => {
  test = await createTestBlog();
});

afterEach(async () => {
  await test.database.close();
});

async function publish(input: BlogArticleInput) {
  const result = await publishArticle(test.ctx, input);
  if (!result.ok) throw new Error(`refused: ${result.error}`);
  return result;
}

describe("publishArticle", () => {
  it("adds a new published article with a publication date and no update date", async () => {
    const result = await publish(buildInput());
    expect(result).toEqual({
      ok: true,
      action: "added",
      before: null,
      after: { slug: "index-funds", status: "published", publishedAt: NOW, updatedAt: null, contentSha256: buildInput().contentSha256 },
      previousSlug: null,
    });
    const row = await findArticleBySlug(test.ctx, "index-funds");
    expect(row).toMatchObject({ id: "index-funds", kind: "article", createdAt: NOW, sources: [{ name: "Fund factsheet", url: "https://example.com/factsheet" }], termForms: [], fields: {} });
  });

  it("stores a term with its forms and the app's fields", async () => {
    await publish({ ...buildInput({ id: "tax-wrapper", slug: "tax-wrapper", kind: "term", forms: ["tax wrapper"] }), fields: { scenario: "a=1" } });
    expect(await findArticleBySlug(test.ctx, "tax-wrapper")).toMatchObject({ kind: "term", termForms: ["tax wrapper"], fields: { scenario: "a=1" } });
  });

  it("takes the publication date from the file over the moment of writing", async () => {
    expect((await publish(buildInput({ published_at: "2026-09-01" }))).after.publishedAt).toEqual(new Date("2026-09-01T00:00:00Z"));
  });

  it("moves the publication date back when the file gains one, without an update date", async () => {
    await publish(buildInput());
    test.clock.set(LATER);
    const result = await publish(buildInput({ published_at: "2026-09-01" }));
    expect([result.action, result.after.publishedAt, result.after.updatedAt]).toEqual(["changed", new Date("2026-09-01T00:00:00Z"), null]);
  });

  it("gives a draft no publication date and keeps it off the lists", async () => {
    const result = await publish(buildInput({ status: "draft" }));
    expect(result.after.publishedAt).toBeNull();
    expect(await listArticles(test.ctx)).toEqual([]);
    expect(await getPublishedArticle(test.ctx, "index-funds")).toBeNull();
    expect(await findArticleBySlug(test.ctx, "index-funds")).toMatchObject({ status: "draft" });
  });

  it("writes nothing for the same file again and keeps the dates", async () => {
    const first = await publish(buildInput());
    test.clock.set(LATER);
    const second = await publish(buildInput());
    expect(second).toEqual({ ok: true, action: "unchanged", before: first.after, after: first.after, previousSlug: null });
  });

  it("sets the update date when the content of a published text changes and keeps the publication date", async () => {
    await publish(buildInput());
    test.clock.set(LATER);
    const result = await publish(buildInput({}, "A new body."));
    expect([result.action, result.after.publishedAt, result.after.updatedAt]).toEqual(["changed", NOW, LATER]);
    expect((await getPublishedArticle(test.ctx, "index-funds"))?.bodyMarkdown).toBe("A new body.");
  });

  it("records the pillar flag without an update date", async () => {
    await publish(buildInput({ cluster: "basics" }));
    test.clock.set(LATER);
    const result = await publish(buildInput({ cluster: "basics", pillar: true }));
    expect([result.action, result.after.updatedAt]).toEqual(["changed", null]);
    expect((await findArticleBySlug(test.ctx, "index-funds"))?.isPillar).toBe(true);
  });

  it("does not count a draft's edits as updates", async () => {
    await publish(buildInput({ status: "draft" }));
    test.clock.set(LATER);
    const result = await publish(buildInput({ status: "draft" }, "Edited."));
    expect([result.action, result.after.publishedAt, result.after.updatedAt]).toEqual(["changed", null, null]);
  });

  it("publishes a draft now, without an update date", async () => {
    await publish(buildInput({ status: "draft" }));
    test.clock.set(LATER);
    const result = await publish(buildInput({}, "Edited before going public."));
    expect([result.after.status, result.after.publishedAt, result.after.updatedAt]).toEqual(["published", LATER, null]);
  });

  it("keeps the dates when a text is withdrawn and comes back unchanged", async () => {
    await publish(buildInput());
    test.clock.set(LATER);
    const withdrawn = await publish(buildInput({ status: "withdrawn" }));
    expect([withdrawn.action, withdrawn.after.status, withdrawn.after.publishedAt, withdrawn.after.updatedAt]).toEqual(["changed", "withdrawn", NOW, null]);
    const back = await publish(buildInput());
    expect([back.after.status, back.after.publishedAt, back.after.updatedAt]).toEqual(["published", NOW, null]);
  });

  it("records the old slug on a slug change, and the old slug leads to the new one", async () => {
    await publish(buildInput());
    const result = await publish(buildInput({ slug: "index-funds-explained" }));
    expect([result.action, result.previousSlug, result.after.slug, result.after.updatedAt]).toEqual(["changed", "index-funds", "index-funds-explained", null]);
    expect(await findSlugRedirect(test.ctx, "index-funds")).toBe("index-funds-explained");
    expect(await findArticleBySlug(test.ctx, "index-funds")).toBeNull();
  });

  it("leads every old slug straight to the current one after two changes", async () => {
    await publish(buildInput());
    await publish(buildInput({ slug: "second" }));
    await publish(buildInput({ slug: "third" }));
    expect([await findSlugRedirect(test.ctx, "index-funds"), await findSlugRedirect(test.ctx, "second")]).toEqual(["third", "third"]);
  });

  it("drops an old slug from the history when the article takes it back", async () => {
    await publish(buildInput());
    await publish(buildInput({ slug: "second" }));
    await publish(buildInput());
    expect(await findSlugRedirect(test.ctx, "index-funds")).toBeNull();
    expect(await findSlugRedirect(test.ctx, "second")).toBe("index-funds");
  });

  it("refuses a slug another article has now and writes nothing", async () => {
    await publish(buildInput());
    const result = await publishArticle(test.ctx, buildInput({ id: "other" }));
    expect(result).toEqual({ ok: false, error: "blog.slug_taken", otherArticleId: "index-funds" });
    expect(await findArticleBySlug(test.ctx, "index-funds")).toMatchObject({ id: "index-funds" });
  });

  it("refuses a slug from another article's history: the 301 would have two targets", async () => {
    await publish(buildInput());
    await publish(buildInput({ slug: "renamed" }));
    const result = await publishArticle(test.ctx, buildInput({ id: "other" }));
    expect(result).toEqual({ ok: false, error: "blog.slug_in_history", otherArticleId: "index-funds" });
  });
});

describe("reads", () => {
  it("lists published texts newest first, ties by slug, filtered by kind and cluster", async () => {
    await publish(buildInput({ id: "b", slug: "b", published_at: "2026-09-02" }));
    await publish(buildInput({ id: "a", slug: "a", published_at: "2026-09-02", cluster: "basics" }));
    await publish(buildInput({ id: "c", slug: "c", published_at: "2026-09-03", cluster: "basics" }));
    await publish(buildInput({ id: "t", slug: "t", kind: "term", forms: ["term"], published_at: "2026-09-04" }));
    await publish(buildInput({ id: "d", slug: "d", status: "withdrawn", published_at: "2026-09-05" }));
    const slugs = async (filter?: Parameters<typeof listArticles>[1]) => (await listArticles(test.ctx, filter)).map((row) => row.slug);
    expect(await slugs()).toEqual(["t", "c", "a", "b"]);
    expect(await slugs({ kind: "article" })).toEqual(["c", "a", "b"]);
    expect(await slugs({ kind: "term" })).toEqual(["t"]);
    expect(await slugs({ cluster: "basics" })).toEqual(["c", "a"]);
  });

  it("finds a withdrawn text by slug but does not serve it as published", async () => {
    await publish(buildInput({ status: "withdrawn" }));
    expect(await findArticleBySlug(test.ctx, "index-funds")).toMatchObject({ status: "withdrawn" });
    expect(await getPublishedArticle(test.ctx, "index-funds")).toBeNull();
    expect(await findSlugRedirect(test.ctx, "nowhere")).toBeNull();
  });
});

describe("blog.articles constraints", () => {
  const COLUMNS = "id, slug, kind, cluster, is_pillar, title, description, body_markdown, status, current_as_of, published_at, updated_at, term_forms, content_sha256, created_at";

  async function insert(values: Readonly<Record<string, unknown>> = {}) {
    const row = {
      id: "row",
      slug: "row",
      kind: "article",
      cluster: null,
      is_pillar: false,
      title: "T",
      description: "D",
      body_markdown: "B",
      status: "published",
      current_as_of: "2026-10-01",
      published_at: NOW,
      updated_at: null,
      term_forms: "[]",
      content_sha256: "a".repeat(64),
      created_at: NOW,
      ...values,
    };
    await test.database.client.query(`INSERT INTO blog.articles (${COLUMNS}) VALUES (${COLUMNS.split(", ").map((_, index) => `$${String(index + 1)}`).join(", ")})`, Object.values(row));
  }

  it("accepts a valid row", async () => {
    await expect(insert()).resolves.toBeUndefined();
  });

  it.each([
    ["a published text without a publication date", { published_at: null }, "articles_published_has_date"],
    ["an update date without a publication date", { status: "draft", published_at: null, updated_at: NOW }, "articles_updated_after_publication"],
    ["an unknown status", { status: "live" }, "articles_status_check"],
    ["an unknown kind", { kind: "page" }, "articles_kind_check"],
    ["a slug that is not kebab-case", { slug: "Row_1" }, "articles_slug_check"],
    ["a pillar without a cluster", { is_pillar: true }, "articles_pillar_has_cluster"],
    ["a term without forms", { kind: "term" }, "articles_term_forms_by_kind"],
    ["an article with forms", { term_forms: '["x"]' }, "articles_term_forms_by_kind"],
    ["a hash that is not sha256 hex", { content_sha256: "abc" }, "articles_content_sha256_check"],
    ["an empty body", { body_markdown: "" }, "articles_body_markdown_check"],
  ])("refuses %s", async (_name, values, constraint) => {
    await expect(insert(values)).rejects.toMatchObject({ constraint });
  });

  it("refuses a second row with the same slug", async () => {
    await insert();
    await expect(insert({ id: "other" })).rejects.toMatchObject({ constraint: "articles_slug_key" });
  });

  it("allows one pillar per cluster at commit, and a move of the pillar inside one transaction", async () => {
    await insert({ id: "a", slug: "a", cluster: "basics", is_pillar: true });
    await insert({ id: "w", slug: "w", cluster: "basics", is_pillar: true, status: "withdrawn" });
    await test.database.client.exec("BEGIN; UPDATE blog.articles SET is_pillar = false WHERE id = 'a'");
    await insert({ id: "b", slug: "b", cluster: "basics", is_pillar: true });
    await test.database.client.exec("COMMIT");
    await expect(insert({ id: "c", slug: "c", cluster: "basics", is_pillar: true })).rejects.toMatchObject({ constraint: "articles_one_pillar_per_cluster" });
  });

  it("removes an article's slug history with the article", async () => {
    await publish(buildInput());
    await publish(buildInput({ slug: "renamed" }));
    await test.database.client.exec("DELETE FROM blog.articles");
    expect((await test.database.client.query("SELECT * FROM blog.slug_history")).rows).toEqual([]);
  });
});

// A publish run on PGlite (FIRE_TRACKER `src/db/blog-publish.test.ts`): all or nothing, dry run by
// default, the pillar rule over the run and in the database, the gate hook.
import { findArticleBySlug, listArticles, parseArticleFile, publishArticle, runBlogPublish, type PublishGate } from "@softure-ai/blog/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildArticleFile, createTestBlog, type TestBlog } from "./support.js";

let test: TestBlog;

beforeEach(async () => {
  test = await createTestBlog();
});

afterEach(async () => {
  await test.database.close();
});

const FIRST = buildArticleFile();
const SECOND = buildArticleFile({ id: "bonds", slug: "bonds", title: "Bonds" });

async function countRows(): Promise<number> {
  const result = await test.database.client.query<{ count: number }>("SELECT count(*)::int AS count FROM blog.articles");
  return result.rows[0]?.count ?? -1;
}

describe("runBlogPublish", () => {
  it("shows a dry run like a commit and writes nothing", async () => {
    const run = await runBlogPublish(test.ctx, [FIRST, SECOND]);
    expect(run).toEqual({
      status: "done",
      committed: false,
      warnings: [],
      changes: [
        { id: "index-funds", kind: "article", action: "added", statusBefore: null, statusAfter: "published", slugBefore: null, slug: "index-funds", previousSlug: null },
        { id: "bonds", kind: "article", action: "added", statusBefore: null, statusAfter: "published", slugBefore: null, slug: "bonds", previousSlug: null },
      ],
    });
    expect(await countRows()).toBe(0);
  });

  it("writes with commit; a second run is unchanged", async () => {
    expect(await runBlogPublish(test.ctx, [FIRST, SECOND], { commit: true })).toMatchObject({ status: "done", committed: true });
    expect(await countRows()).toBe(2);
    const second = await runBlogPublish(test.ctx, [FIRST, SECOND], { commit: true });
    expect(second.status === "done" && second.changes.map((change) => change.action)).toEqual(["unchanged", "unchanged"]);
  });

  it("writes nothing, not even the valid files, when one file is bad", async () => {
    const bad = { name: "broken.md", text: "no frontmatter" };
    const run = await runBlogPublish(test.ctx, [FIRST, bad, SECOND], { commit: true });
    expect(run).toEqual({
      status: "refused",
      problems: [{ subject: "broken.md", message: "no frontmatter: the file starts with a --- line, the metadata, then a --- line" }],
      warnings: [],
    });
    expect(await countRows()).toBe(0);
  });

  it("rolls back earlier writes when a slug is taken in the middle of the run", async () => {
    await runBlogPublish(test.ctx, [FIRST], { commit: true });
    const thief = buildArticleFile({ id: "thief" });
    const run = await runBlogPublish(test.ctx, [SECOND, thief], { commit: true });
    expect(run).toEqual({
      status: "refused",
      problems: [{ subject: "thief", message: "slug index-funds is the slug of article index-funds (blog.slug_taken)" }],
      warnings: [],
    });
    expect(await findArticleBySlug(test.ctx, "bonds")).toBeNull();
  });

  it("names a slug that redirects to another article", async () => {
    await runBlogPublish(test.ctx, [FIRST], { commit: true });
    await runBlogPublish(test.ctx, [buildArticleFile({ slug: "renamed" })], { commit: true });
    const run = await runBlogPublish(test.ctx, [buildArticleFile({ id: "other" })], { commit: true });
    expect(run.status === "refused" && run.problems).toEqual([{ subject: "other", message: "slug index-funds redirects to article index-funds (blog.slug_in_history)" }]);
  });

  it("refuses two files with one id before any write", async () => {
    const copy = buildArticleFile({ slug: "copy" });
    expect(await runBlogPublish(test.ctx, [FIRST, copy], { commit: true })).toEqual({
      status: "refused",
      problems: [{ subject: "index-funds", message: "two files have this id" }],
      warnings: [],
    });
  });

  it("withdraws a file whatever its status, and warns that the file still says otherwise", async () => {
    await runBlogPublish(test.ctx, [FIRST], { commit: true });
    const run = await runBlogPublish(test.ctx, [FIRST], { commit: true, withdraw: true });
    expect(run).toMatchObject({
      status: "done",
      changes: [{ action: "changed", statusBefore: "published", statusAfter: "withdrawn" }],
      warnings: [{ subject: "index-funds.md", message: "the file says status: published; set it to withdrawn, or the next full publish brings the text back" }],
    });
    expect(await listArticles(test.ctx)).toEqual([]);
  });

  it("reports a slug change with the old and the new slug", async () => {
    await runBlogPublish(test.ctx, [FIRST], { commit: true });
    const run = await runBlogPublish(test.ctx, [buildArticleFile({ slug: "renamed" })], { commit: true });
    expect(run).toMatchObject({ status: "done", changes: [{ action: "changed", slugBefore: "index-funds", slug: "renamed", previousSlug: "index-funds" }] });
  });

  it("refuses two pillars in one cluster within the run", async () => {
    const one = buildArticleFile({ cluster: "basics", pillar: true });
    const two = buildArticleFile({ id: "bonds", slug: "bonds", cluster: "basics", pillar: true });
    expect(await runBlogPublish(test.ctx, [one, two])).toEqual({
      status: "refused",
      problems: [{ subject: "basics", message: "two pillars in one cluster: index-funds, bonds" }],
      warnings: [],
    });
  });

  it("refuses a second pillar against one already in the database, and moves the pillar in one run", async () => {
    await runBlogPublish(test.ctx, [buildArticleFile({ cluster: "basics", pillar: true })], { commit: true });
    const second = buildArticleFile({ id: "bonds", slug: "bonds", cluster: "basics", pillar: true });
    expect(await runBlogPublish(test.ctx, [second], { commit: true })).toEqual({
      status: "refused",
      problems: [{ subject: "pillar", message: "a cluster would have two pillars: one is in the database and not in this run; mark only one text of a cluster pillar: true" }],
      warnings: [],
    });
    expect(await findArticleBySlug(test.ctx, "bonds")).toBeNull();

    const moved = await runBlogPublish(test.ctx, [buildArticleFile({ cluster: "basics" }), second], { commit: true });
    expect(moved.status).toBe("done");
    expect((await findArticleBySlug(test.ctx, "bonds"))?.isPillar).toBe(true);
  });

  it("refuses a file the gate rejects before any write and names the gate", async () => {
    const gate: PublishGate = (file) => (file.name === "bonds.md" ? ["the answer is not in the first paragraph"] : []);
    expect(await runBlogPublish(test.ctx, [FIRST, SECOND], { commit: true, gate })).toEqual({
      status: "refused",
      problems: [{ subject: "bonds.md", message: "quality gate: the answer is not in the first paragraph" }],
      warnings: [],
    });
    expect(await countRows()).toBe(0);
  });

  it("does not gate a withdrawal or a draft", async () => {
    const calls: string[] = [];
    const gate: PublishGate = (file) => {
      calls.push(file.name);
      return ["always fails"];
    };
    const draft = buildArticleFile({ id: "bonds", slug: "bonds", status: "draft" });
    expect((await runBlogPublish(test.ctx, [draft], { commit: true, gate })).status).toBe("done");
    expect((await runBlogPublish(test.ctx, [FIRST], { commit: true, withdraw: true, gate })).status).toBe("done");
    expect(calls).toEqual([]);
  });

  it("passes the reserved slugs and the app's fields to the parser", async () => {
    const reserved = buildArticleFile({ id: "glossary", slug: "glossary" });
    expect(await runBlogPublish(test.ctx, [reserved], { reservedSlugs: ["glossary"] })).toMatchObject({ status: "refused" });
    expect(await runBlogPublish(test.ctx, [buildArticleFile({ scenario: "x" })])).toMatchObject({ status: "refused" });
  });

  it("commits an empty run as zero changes", async () => {
    expect(await runBlogPublish(test.ctx, [], { commit: true })).toEqual({ status: "done", committed: true, changes: [], warnings: [] });
  });
});

describe("runBlogPublish: one term per glossary form", () => {
  const buildTerm = (slug: string, forms: readonly string[], status = "published") =>
    buildArticleFile({ id: slug, slug, kind: "term", forms, status, title: slug, sources: undefined, faq: undefined });
  const conflict = (form: string, slugs: string) => ({ subject: "glossary", message: `form "${form}" is claimed by terms ${slugs}; a form belongs to one term, so remove it from all but one` });

  /** Stores a term without the run's checks, as rows written before them would be. */
  async function storeTerm(slug: string, forms: readonly string[]): Promise<void> {
    const parsed = parseArticleFile(buildTerm(slug, forms).text, `${slug}.md`);
    if (!parsed.ok) throw new Error(`storeTerm: ${parsed.errors.join("; ")}`);
    await publishArticle(test.ctx, parsed.article);
  }

  it("refuses two terms of the run that share a form, naming both, and writes nothing", async () => {
    const run = await runBlogPublish(test.ctx, [buildTerm("isa", ["ISA", "tax wrapper"]), buildTerm("sipp", ["SIPP", "Tax wrapper"])], { commit: true });
    expect(run).toEqual({ status: "refused", problems: [conflict("tax wrapper", "isa, sipp")], warnings: [] });
    expect(await countRows()).toBe(0);
  });

  it("refuses a term of the run whose form a stored term holds, in a dry run too", async () => {
    expect((await runBlogPublish(test.ctx, [buildTerm("isa", ["ISA"])], { commit: true })).status).toBe("done");
    const expected = { status: "refused", problems: [conflict("ISA", "isa, stocks-isa")], warnings: [] };
    expect(await runBlogPublish(test.ctx, [buildTerm("stocks-isa", ["ISA"])])).toEqual(expected);
    expect(await runBlogPublish(test.ctx, [buildTerm("stocks-isa", ["ISA"])], { commit: true })).toEqual(expected);
    expect(await countRows()).toBe(1);
  });

  it("lets a draft or a withdrawn term keep a form a published term has", async () => {
    expect((await runBlogPublish(test.ctx, [buildTerm("isa", ["ISA"]), buildTerm("old-isa", ["ISA"], "draft")], { commit: true })).status).toBe("done");
    expect((await runBlogPublish(test.ctx, [buildTerm("new-isa", ["ISA"])], { commit: true, withdraw: true })).status).toBe("done");
  });

  it("reads the terms after the run's writes: a run that drops the form fixes the conflict", async () => {
    await storeTerm("isa", ["ISA"]);
    await storeTerm("stocks-isa", ["ISA", "stocks and shares ISA"]);
    expect(await runBlogPublish(test.ctx, [buildTerm("stocks-isa", ["stocks and shares ISA"])], { commit: true })).toMatchObject({ status: "done", warnings: [] });
  });

  it("warns about a stored conflict the run does not touch and publishes", async () => {
    await storeTerm("isa", ["ISA"]);
    await storeTerm("stocks-isa", ["ISA"]);
    expect(await runBlogPublish(test.ctx, [FIRST], { commit: true })).toMatchObject({ status: "done", committed: true, warnings: [conflict("ISA", "isa, stocks-isa")] });
  });
});

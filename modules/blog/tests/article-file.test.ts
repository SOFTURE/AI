// The article file format (FIRE_TRACKER `src/lib/blog-article-file.test.ts`, with English keys).
import { createHash } from "node:crypto";
import type { BlogArticleContent } from "@softure-ai/blog";
import { computeContentHash, parseArticleFile, type ArticleFileResult } from "@softure-ai/blog/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { buildArticleText } from "./support.js";

function parseOk(result: ArticleFileResult) {
  if (!result.ok) throw new Error(`expected a valid file, got: ${result.errors.join("; ")}`);
  return result.article;
}

function parseErrors(result: ArticleFileResult): readonly string[] {
  if (result.ok) throw new Error("expected a refused file");
  return result.errors;
}

const TERM = { id: "tax-wrapper", slug: "tax-wrapper", kind: "term", forms: ["tax wrapper", "tax wrappers"] };

describe("parseArticleFile", () => {
  it("reads every field of a complete file and the body without the frontmatter", () => {
    const text = buildArticleText({
      cluster: "investing-basics",
      summary: "Three sentences with numbers.",
      published_at: "2026-09-30",
    });
    const article = parseOk(parseArticleFile(text, "content/blog/index-funds.md"));
    expect(article).toEqual({
      id: "index-funds",
      slug: "index-funds",
      kind: "article",
      cluster: "investing-basics",
      isPillar: false,
      title: "Index funds in plain words",
      description: "What an index fund is and what it costs.",
      summary: "Three sentences with numbers.",
      bodyMarkdown: "An index fund buys the whole market.\n\n## Costs\n\nLow fees.",
      status: "published",
      currentAsOf: "2026-10-01",
      publishedAt: new Date("2026-09-30T00:00:00Z"),
      sources: [{ name: "Fund factsheet", url: "https://example.com/factsheet" }],
      faq: [{ question: "Is it safe?", answer: "It follows the market, up and down." }],
      termForms: [],
      fields: {},
      contentSha256: expect.stringMatching(/^[0-9a-f]{64}$/) as unknown,
    });
  });

  it("fills in the defaults without optional keys: an article, empty lists, nulls", () => {
    const article = parseOk(parseArticleFile(buildArticleText({ sources: undefined, faq: undefined }), "index-funds.md"));
    expect([article.kind, article.cluster, article.summary, article.publishedAt, article.isPillar]).toEqual(["article", null, null, null, false]);
    expect([article.sources, article.faq, article.termForms, article.fields]).toEqual([[], [], [], {}]);
  });

  it("reads a publication moment with an offset", () => {
    const article = parseOk(parseArticleFile(buildArticleText({ published_at: "2026-09-30T10:15:00+02:00" }), "index-funds.md"));
    expect(article.publishedAt).toEqual(new Date("2026-09-30T08:15:00Z"));
  });

  it("reads CRLF line endings and a byte order mark like LF, with the same hash", () => {
    const text = buildArticleText();
    const lf = parseOk(parseArticleFile(text, "index-funds.md"));
    const crlf = parseOk(parseArticleFile(`\uFEFF${text.replace(/\n/g, "\r\n")}`, "index-funds.md"));
    expect(crlf).toEqual(lf);
  });

  it("refuses a file without a frontmatter or with an unclosed one", () => {
    expect(parseErrors(parseArticleFile("# Title\n\nBody", "index-funds.md"))).toEqual(["no frontmatter: the file starts with a --- line, the metadata, then a --- line"]);
    expect(parseErrors(parseArticleFile("---\nid: a\n\nBody", "index-funds.md"))).toEqual(["no frontmatter: the file starts with a --- line, the metadata, then a --- line"]);
  });

  it("refuses invalid YAML and a frontmatter that is not a mapping", () => {
    expect(parseErrors(parseArticleFile("---\nid: [a\n---\nBody", "index-funds.md"))[0]).toMatch(/^the frontmatter is not valid YAML: /);
    expect(parseErrors(parseArticleFile("---\n- a\n---\nBody", "index-funds.md"))).toEqual(["the frontmatter must be a YAML mapping of keys to values"]);
  });

  it("refuses an unknown key, so a typo cannot pass as a missing value", () => {
    expect(parseErrors(parseArticleFile(buildArticleText({ current_as_on: "2026-10-01" }), "index-funds.md"))).toEqual(['frontmatter: Unrecognized key: "current_as_on"']);
  });

  it("names each invalid field: slug shape, status, date, source address", () => {
    const text = buildArticleText({ slug: "Index_Funds", status: "live", current_as_of: "2026-13-01", sources: [{ name: "x", url: "ftp://example.com" }] });
    expect(parseErrors(parseArticleFile(text, "index-funds.md"))).toEqual([
      "slug: lowercase letters, digits and single hyphens, e.g. index-funds-basics",
      'status: Invalid option: expected one of "draft"|"published"|"withdrawn"',
      "current_as_of: Invalid ISO date",
      "sources.0.url: must be an http(s) address",
    ]);
  });

  it("refuses an empty body", () => {
    expect(parseErrors(parseArticleFile(buildArticleText({}, "  "), "index-funds.md"))).toEqual(["the body under the frontmatter is empty"]);
  });

  it("refuses a file name that differs from the slug", () => {
    expect(parseErrors(parseArticleFile(buildArticleText(), "content/blog/index.md"))).toEqual(["the file name index.md differs from the slug plus .md (index-funds.md)"]);
  });

  it("refuses a slug a static page of the blog takes", () => {
    const text = buildArticleText({ id: "glossary", slug: "glossary" });
    expect(parseErrors(parseArticleFile(text, "glossary.md", { reservedSlugs: ["glossary"] }))).toEqual(["slug glossary is taken by a static page of the blog; choose another"]);
    expect(parseArticleFile(text, "glossary.md").ok).toBe(true);
  });

  it("marks a pillar only with a cluster, and the pillar flag leaves the hash alone", () => {
    const satellite = parseOk(parseArticleFile(buildArticleText({ cluster: "investing-basics" }), "index-funds.md"));
    const pillar = parseOk(parseArticleFile(buildArticleText({ cluster: "investing-basics", pillar: true }), "index-funds.md"));
    expect([satellite.isPillar, pillar.isPillar]).toEqual([false, true]);
    expect(pillar.contentSha256).toBe(satellite.contentSha256);
    expect(parseErrors(parseArticleFile(buildArticleText({ pillar: true }), "index-funds.md"))).toEqual([
      "pillar: true needs a cluster; a pillar is the main text of one topic",
    ]);
  });

  it("reads a term's forms, and refuses a term without forms and an article with them", () => {
    expect(parseOk(parseArticleFile(buildArticleText(TERM), "tax-wrapper.md")).termForms).toEqual(["tax wrapper", "tax wrappers"]);
    expect(parseErrors(parseArticleFile(buildArticleText({ ...TERM, forms: undefined }), "tax-wrapper.md"))).toEqual([
      "forms: a term needs at least one form, or no article links to it",
    ]);
    expect(parseErrors(parseArticleFile(buildArticleText({ ...TERM, forms: [] }), "tax-wrapper.md"))).toEqual([
      "forms: a term needs at least one form, or no article links to it",
    ]);
    expect(parseErrors(parseArticleFile(buildArticleText({ forms: ["index fund"] }), "index-funds.md"))).toEqual([
      "forms: only for kind: term; an article is not a link target",
    ]);
  });

  describe("the app's fields", () => {
    const fields = z.object({ scenario: z.string().regex(/^[a-z]=\d+(&[a-z]=\d+)*$/, "scenario: pairs like a=35&b=6000").optional() });

    it("reads the app's keys with its schema and stores their parsed value", () => {
      const article = parseOk(parseArticleFile(buildArticleText({ scenario: "a=35&b=6000" }), "index-funds.md", { fields }));
      expect(article.fields).toEqual({ scenario: "a=35&b=6000" });
      expect(parseOk(parseArticleFile(buildArticleText(), "index-funds.md", { fields })).fields).toEqual({});
    });

    it("reports the app schema's problems next to the module's", () => {
      const text = buildArticleText({ scenario: "#a=35", status: "live" });
      expect(parseErrors(parseArticleFile(text, "index-funds.md", { fields }))).toEqual([
        'status: Invalid option: expected one of "draft"|"published"|"withdrawn"',
        "scenario: scenario: pairs like a=35&b=6000",
      ]);
    });

    it("keeps an app key unknown when the app does not declare it", () => {
      expect(parseErrors(parseArticleFile(buildArticleText({ scenario: "a=35" }), "index-funds.md"))).toEqual(['frontmatter: Unrecognized key: "scenario"']);
    });

    it("puts the fields into the hash, whatever their key order", () => {
      const pair = z.object({ a: z.number().optional(), b: z.number().optional() });
      const plain = parseOk(parseArticleFile(buildArticleText(), "index-funds.md", { fields: pair }));
      const ab = parseOk(parseArticleFile(buildArticleText({ a: 1, b: 2 }), "index-funds.md", { fields: pair }));
      const ba = parseOk(parseArticleFile(buildArticleText({ b: 2, a: 1 }), "index-funds.md", { fields: pair }));
      expect(ab.contentSha256).toBe(ba.contentSha256);
      expect(ab.contentSha256).not.toBe(plain.contentSha256);
    });
  });
});

describe("computeContentHash", () => {
  const CONTENT: BlogArticleContent = {
    kind: "article",
    cluster: "investing-basics",
    title: "Title",
    description: "Description",
    summary: null,
    bodyMarkdown: "Body",
    currentAsOf: "2026-10-01",
    sources: [{ name: "Source", url: "https://example.com/" }],
    faq: [{ question: "Q?", answer: "A." }],
    termForms: [],
    fields: {},
  };

  it("is the sha256 of a fixed array of the content fields", () => {
    const canonical = JSON.stringify(["article", "investing-basics", "Title", "Description", null, "Body", "2026-10-01", [["Source", "https://example.com/"]], [["Q?", "A."]]]);
    expect(computeContentHash(CONTENT)).toBe(createHash("sha256").update(canonical).digest("hex"));
  });

  it("appends term forms and fields only when present", () => {
    const canonical = JSON.stringify(["term", "investing-basics", "Title", "Description", null, "Body", "2026-10-01", [["Source", "https://example.com/"]], [["Q?", "A."]], ["a form"], { x: 1 }]);
    expect(computeContentHash({ ...CONTENT, kind: "term", termForms: ["a form"], fields: { x: 1 } })).toBe(createHash("sha256").update(canonical).digest("hex"));
  });

  it("does not depend on status, slug, publication date or pillar", () => {
    const base = parseArticleFile(buildArticleText({ cluster: "c" }), "index-funds.md");
    const moved = parseArticleFile(buildArticleText({ cluster: "c", id: "index-funds", slug: "funds", status: "draft", published_at: "2026-01-01", pillar: true }), "funds.md");
    expect(base.ok && moved.ok && base.article.contentSha256 === moved.article.contentSha256).toBe(true);
  });

  it("changes with every field a reader sees", () => {
    const base = computeContentHash(CONTENT);
    const variants: Partial<BlogArticleContent>[] = [
      { kind: "term" },
      { cluster: null },
      { title: "Other" },
      { description: "Other" },
      { summary: "Other" },
      { bodyMarkdown: "Other" },
      { currentAsOf: "2026-10-02" },
      { sources: [] },
      { faq: [] },
      { termForms: ["x"] },
      { fields: { x: 1 } },
    ];
    for (const variant of variants) expect(computeContentHash({ ...CONTENT, ...variant }), JSON.stringify(variant)).not.toBe(base);
  });
});

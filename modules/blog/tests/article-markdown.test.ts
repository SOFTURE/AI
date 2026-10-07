// Markdown for agents: an article or term page asked for with `Accept: text/markdown` answers with the
// stored Markdown, its frame (title, description, summary, sources, FAQ) and plugin blocks in their
// Markdown form.
import { createBlogMarkdown, prefersMarkdown } from "@softure-ai/blog/proxy";
import { toArticleMarkdown, type BlockPlugin } from "@softure-ai/blog/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createPublishedBlog } from "./next/support.js";
import type { TestBlog } from "./support.js";

const chartDirective: BlockPlugin = {
  type: "chart",
  syntax: "directive",
  render: () => ({ kind: "html", html: "<figure></figure>" }),
  markdown: (block) => `| Year | Wealth (${block.attributes?.["type"] ?? "?"}) |\n| --- | --- |\n| 2030 | 100 |`,
};
const tableFence: BlockPlugin = { type: "table", render: () => ({ kind: "html", html: "<table></table>" }) };

const ARTICLE = {
  title: "Index funds",
  description: "What an index fund is.",
  summary: "Cheap and broad.",
  bodyMarkdown: 'Intro.\n\n::chart{type="wealth"}\n\n```table\nraw\n```\n\nEnd.',
  sources: [{ name: "Regulator", url: "https://example.org/r" }],
  faq: [{ question: "Is it safe?", answer: "It follows the market." }],
  currentAsOf: "2026-10-01",
  fields: {},
};

describe("toArticleMarkdown", () => {
  it("frames the body and replaces blocks that have a Markdown form", () => {
    expect(toArticleMarkdown(ARTICLE, { blocks: [chartDirective, tableFence] })).toBe(
      [
        "# Index funds",
        "",
        "What an index fund is.",
        "",
        "Current as of: 2026-10-01",
        "",
        "> **In short:** Cheap and broad.",
        "",
        "Intro.",
        "",
        "| Year | Wealth (wealth) |",
        "| --- | --- |",
        "| 2030 | 100 |",
        "",
        "```table",
        "raw",
        "```",
        "",
        "End.",
        "",
        "## Sources",
        "",
        "- [Regulator](https://example.org/r)",
        "",
        "## Questions and answers",
        "",
        "### Is it safe?",
        "",
        "It follows the market.",
        "",
      ].join("\n"),
    );
  });

  it("leaves out empty parts and keeps block sources without plugins", () => {
    expect(toArticleMarkdown({ ...ARTICLE, summary: null, sources: [], faq: [] })).toBe(
      "# Index funds\n\nWhat an index fund is.\n\nCurrent as of: 2026-10-01\n\n" + ARTICLE.bodyMarkdown + "\n",
    );
  });
});

describe("prefersMarkdown", () => {
  it("asks for an explicit text/markdown at least as heavy as HTML", () => {
    expect(prefersMarkdown("text/markdown")).toBe(true);
    expect(prefersMarkdown("text/markdown, text/html")).toBe(true);
    expect(prefersMarkdown("text/html;q=0.8, text/markdown;q=0.9")).toBe(true);
    expect(prefersMarkdown("text/html, text/markdown;q=0.5")).toBe(false);
    expect(prefersMarkdown("*/*")).toBe(false);
    expect(prefersMarkdown("text/*")).toBe(false);
    expect(prefersMarkdown("text/markdown;q=0")).toBe(false);
    expect(prefersMarkdown(null)).toBe(false);
    expect(prefersMarkdown("text/html,application/xhtml+xml,*/*;q=0.8")).toBe(false);
  });
});

let test: TestBlog;

beforeEach(async () => {
  test = await createPublishedBlog();
});
afterEach(async () => {
  await test.database.close();
});

const ask = (path: string, accept = "text/markdown", method = "GET") => new Request(`https://app.example.com${path}`, { method, headers: { accept } });

describe("createBlogMarkdown", () => {
  it("answers an article and a term with Markdown", async () => {
    const piece = createBlogMarkdown(test.config, { getContext: () => Promise.resolve(test.ctx) });
    const article = await piece(ask("/blog/index-funds?z=x"));
    expect(article?.status).toBe(200);
    expect(article?.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
    expect(article?.headers.get("vary")).toBe("Accept");
    expect(article?.headers.get("cache-control")).toBe("private, max-age=0, must-revalidate");
    const text = (await article?.text()) ?? "";
    expect(text).toMatch(/^# /);
    expect(text).toContain("> **In short:** Index funds are cheap and broad.");
    expect(text).toContain("### Is it safe?");
    expect(article?.headers.get("x-markdown-tokens")).toBe(String(Math.ceil(text.length / 4)));
    const term = await piece(ask("/blog/glossary/expense-ratio"));
    expect((await term?.text()) ?? "").toContain("The yearly cost of a fund.");
    const head = await piece(ask("/blog/index-funds", "text/markdown", "HEAD"));
    expect(head?.status).toBe(200);
    expect(await head?.text()).toBe("");
  });

  it("leaves HTML requests, drafts, withdrawn and unknown texts and other paths to the app", async () => {
    const piece = createBlogMarkdown(test.config, { getContext: () => Promise.resolve(test.ctx) });
    expect(await piece(ask("/blog/index-funds", "text/html"))).toBeNull();
    expect(await piece(ask("/blog/index-funds", "*/*"))).toBeNull();
    for (const path of ["/blog/draft", "/blog/stale", "/blog/missing", "/blog", "/blog/glossary", "/pricing", "/blog/expense-ratio"]) {
      expect(await piece(ask(path)), path).toBeNull();
    }
    expect(await piece(ask("/blog/index-funds", "text/markdown", "POST"))).toBeNull();
  });

  it("passes requests on when the database fails", async () => {
    const errors: string[] = [];
    const piece = createBlogMarkdown(test.config, { getContext: () => Promise.reject(new Error("connection refused")), onError: (message) => errors.push(message) });
    expect(await piece(ask("/blog/index-funds"))).toBeNull();
    expect(errors).toEqual(["@softure-ai/blog: reading /blog/index-funds as Markdown failed: connection refused"]);
  });
});

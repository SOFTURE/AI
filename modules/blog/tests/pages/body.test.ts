// A page body follows the blog's options (here `externalLinkMarker`); the articles that link a term are found without rendering blocks.
import { blogMessages, type BlogOptionsInput } from "@softure-ai/blog";
import { findArticlesLinkingTerm, getBlogOptions, renderPageBody, type RenderPageBodyOptions } from "@softure-ai/blog/server";
import { describe, expect, it } from "vitest";
import { buildStoredArticle, buildStoredTerm, createConfig } from "../support.js";

const ROUTES = { index: "/blog", glossary: "/blog/glossary", method: "/blog/how-we-write", rss: "/blog/rss.xml" };

function bodyOf(options: BlogOptionsInput): string | null {
  const input: RenderPageBodyOptions = {
    glossary: [],
    routes: ROUTES,
    options: getBlogOptions(createConfig(options)),
    origins: ["https://example.com"],
    messages: blogMessages.en,
  };
  return renderPageBody(buildStoredArticle({ bodyMarkdown: "[ONS](https://www.ons.gov.uk/) and [home](https://example.com/)" }), input).html;
}

describe("renderPageBody: external links", () => {
  it("adds the arrow and the hidden words by default", () => {
    expect(bodyOf({})).toBe(
      '<p><a href="https://www.ons.gov.uk/" rel="noopener noreferrer" target="_blank" class="blog-external">ONS' +
        '<span class="blog-external-marker" aria-hidden="true">↗</span><span class="blog-visually-hidden"> (opens in a new tab)</span></a> ' +
        'and <a href="https://example.com/">home</a></p>\n',
    );
  });

  it("adds nothing after the link with externalLinkMarker: \"none\"", () => {
    expect(bodyOf({ externalLinkMarker: "none" })).toBe(
      '<p><a href="https://www.ons.gov.uk/" rel="noopener noreferrer" target="_blank" class="blog-external">ONS</a> and <a href="https://example.com/">home</a></p>\n',
    );
  });

  it("refuses an unknown marker at startup", () => {
    expect(() => createConfig({ externalLinkMarker: "arrow" as never })).toThrow(/externalLinkMarker/);
  });
});

describe("findArticlesLinkingTerm (#937)", () => {
  const glossary = [{ slug: "expense-ratio", forms: ["expense ratio"] }];
  const plugin = {
    type: "chart",
    render: () => {
      throw new Error("a block must not be rendered to find the links");
    },
  };
  const input: RenderPageBodyOptions = {
    glossary,
    routes: ROUTES,
    options: getBlogOptions(createConfig({ blocks: [plugin] })),
    origins: ["https://example.com"],
    messages: blogMessages.en,
  };
  const articles = [
    buildStoredArticle({ slug: "mention", bodyMarkdown: "```chart\nexpense ratio\n```\n\nThe expense ratio is a yearly fee." }),
    buildStoredArticle({ slug: "manual", bodyMarkdown: "```chart\n1\n```\n\nSee [the fee](/blog/glossary/expense-ratio)." }),
    buildStoredArticle({ slug: "block-only", bodyMarkdown: "```chart\nexpense ratio\n```\n\nNo term here." }),
  ];

  it("lists the articles that link the term without running a block plugin", () => {
    expect(findArticlesLinkingTerm(articles, "expense-ratio", input).map((article) => article.slug)).toEqual(["mention", "manual"]);
  });

  it("never lists the term's own page", () => {
    const term = buildStoredTerm({ bodyMarkdown: "An expense ratio is a yearly fee." });

    expect(findArticlesLinkingTerm([term], "expense-ratio", input)).toEqual([]);
  });

  it("lists nothing without articles", () => {
    expect(findArticlesLinkingTerm([], "expense-ratio", input)).toEqual([]);
  });
});

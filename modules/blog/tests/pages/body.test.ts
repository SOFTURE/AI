// A page body follows the blog's options: here the marker after external links (`externalLinkMarker`).
import { blogMessages, type BlogOptionsInput } from "@softure-ai/blog";
import { getBlogOptions, renderPageBody, type RenderPageBodyOptions } from "@softure-ai/blog/server";
import { describe, expect, it } from "vitest";
import { buildStoredArticle, createConfig } from "../support.js";

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

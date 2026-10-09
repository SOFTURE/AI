// Issue #332: an app with its own article view reuses the "read next" list, and the static pages'
// metadata keeps the layout's Open Graph card and locale (Next replaces the layout's `openGraph`
// with the page's object, no deep merge).
import { buildBlogIndexMetadata, buildGlossaryIndexMetadata, buildMethodMetadata } from "@softure-ai/blog/next";
import { getPageContext } from "@softure-ai/blog/server";
import { RelatedList, type BlogPageContext } from "@softure-ai/blog/ui";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createConfig } from "./support.js";

const RELATED = [
  { id: "etf-costs", slug: "etf-costs", title: "What an ETF costs", description: "Fees, spreads and taxes." },
  { id: "rebalancing", slug: "rebalancing", title: "Rebalancing", description: "When and how." },
];

function createContext(overrides: Partial<BlogPageContext> = {}): BlogPageContext {
  return { ...getPageContext(createConfig({ methodPage: true })), ...overrides };
}

describe("RelatedList on /ui (#332)", () => {
  it("renders the read-next section an app's own article view can place", () => {
    expect(renderToStaticMarkup(<RelatedList articles={RELATED} context={createContext()} />)).toBe(
      '<section aria-labelledby="blog-related" class="blog-section blog-related"><h2 id="blog-related">Read next</h2><ul>' +
        '<li><h3><a href="/blog/etf-costs">What an ETF costs</a></h3><p>Fees, spreads and taxes.</p></li>' +
        '<li><h3><a href="/blog/rebalancing">Rebalancing</a></h3><p>When and how.</p></li></ul></section>',
    );
  });

  it("renders nothing without articles", () => {
    expect(renderToStaticMarkup(<RelatedList articles={[]} context={createContext()} />)).toBe("");
  });

  it("takes the app's classes for the section, heading, list and item", () => {
    const context = createContext({
      unstyled: true,
      classNames: { related: "mt-8", relatedTitle: "text-xl", relatedList: "grid gap-4", relatedItem: "card" },
    });
    const html = renderToStaticMarkup(<RelatedList articles={RELATED.slice(0, 1)} context={context} />);
    expect(html).toBe(
      '<section aria-labelledby="blog-related" class="mt-8"><h2 id="blog-related" class="text-xl">Read next</h2><ul class="grid gap-4">' +
        '<li class="card"><h3><a href="/blog/etf-costs">What an ETF costs</a></h3><p>Fees, spreads and taxes.</p></li></ul></section>',
    );
  });
});

describe("static pages' Open Graph (#332)", () => {
  const config = createConfig({ methodPage: true });

  it("sets the locale on the listing, glossary and method pages, as the text pages do", () => {
    expect(buildBlogIndexMetadata(config, { isEmpty: false }).openGraph).toEqual({
      type: "website",
      title: "Blog",
      description: expect.any(String) as unknown,
      url: "https://app.example.com/blog",
      locale: "en_US",
    });
    expect(buildGlossaryIndexMetadata(config, { isEmpty: false }).openGraph).toMatchObject({ locale: "en_US" });
    expect(buildMethodMetadata(config).openGraph).toMatchObject({ locale: "en_US" });
  });

  it("carries the app's card into the static pages' Open Graph", () => {
    const images = [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Example" }];
    expect(buildBlogIndexMetadata(config, { isEmpty: false, images }).openGraph).toMatchObject({ images });
    expect(buildGlossaryIndexMetadata(config, { isEmpty: true, images: "/og.png" }).openGraph).toMatchObject({ images: "/og.png" });
    expect(buildMethodMetadata(config, { images }).openGraph).toMatchObject({ images });
    expect(buildMethodMetadata(config).openGraph).not.toHaveProperty("images");
  });
});

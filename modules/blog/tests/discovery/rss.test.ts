// The RSS feed (FIRE's cases).
import { buildBlogRss, type BuildBlogRssInput } from "@softure-ai/blog/server";
import { describe, expect, it } from "vitest";
import { buildText, ROUTES } from "./support.js";

function buildFeed(overrides: Partial<BuildBlogRssInput> = {}): string {
  return buildBlogRss({
    articles: [],
    terms: [],
    origin: "https://example.com",
    routes: ROUTES,
    feedPath: ROUTES.rss,
    channel: { title: "Blog | Example", description: "Texts & notes", language: "en" },
    getCategory: (text) => (text.kind === "term" ? "Glossary" : text.cluster === null ? null : "Investing basics"),
    ...overrides,
  });
}

describe("buildBlogRss", () => {
  const xml = buildFeed({
    articles: [
      buildText("fund-limit", { slug: "fund-limits", title: "Fund limits & taxes <2026>", updatedAt: new Date("2026-10-04T12:00:00Z") }),
      buildText("bridge", { cluster: null }),
    ],
  });

  it("describes the channel: title, the listing's address, a link to itself and the last change", () => {
    expect(xml).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>\n<rss version="2.0"/);
    expect(xml).toContain("<title>Blog | Example</title>");
    expect(xml).toContain("<link>https://example.com/blog</link>");
    expect(xml).toContain("<description>Texts &amp; notes</description>");
    expect(xml).toContain("<language>en</language>");
    expect(xml).toContain('<atom:link href="https://example.com/blog/rss.xml" rel="self" type="application/rss+xml"/>');
    expect(xml).toContain("<lastBuildDate>Sun, 04 Oct 2026 12:00:00 GMT</lastBuildDate>");
  });

  it("writes an item with an escaped title, the slug's address, the id as guid, the publication date and the cluster", () => {
    expect(xml).toContain("<title>Fund limits &amp; taxes &lt;2026&gt;</title>");
    expect(xml).toContain("<link>https://example.com/blog/fund-limits</link>");
    expect(xml).toContain('<guid isPermaLink="false">fund-limit</guid>');
    expect(xml).toContain("<pubDate>Thu, 01 Oct 2026 08:00:00 GMT</pubDate>");
    expect(xml).toContain("<category>Investing basics</category>");
  });

  it("writes no category for a text without one", () => {
    const item = xml.slice(xml.indexOf('<guid isPermaLink="false">bridge</guid>'));
    expect(item.slice(0, item.indexOf("</item>"))).not.toContain("<category>");
  });

  it("lists a term under its glossary address with the glossary category, newest publication first", () => {
    const feed = buildFeed({
      articles: [buildText("article", { publishedAt: new Date("2026-10-01T08:00:00Z") })],
      terms: [buildText("etf", { kind: "term", cluster: null, publishedAt: new Date("2026-10-02T08:00:00Z") })],
    });
    expect(feed).toContain("<link>https://example.com/blog/glossary/etf</link>");
    expect(feed).toContain("<category>Glossary</category>");
    expect(feed.indexOf("/blog/glossary/etf")).toBeLessThan(feed.indexOf("/blog/article"));
  });

  it("is a valid feed without items or a build date for an empty blog", () => {
    const empty = buildFeed();
    expect(empty).toContain("<channel>");
    expect(empty).not.toContain("<item>");
    expect(empty).not.toContain("<lastBuildDate>");
  });
});

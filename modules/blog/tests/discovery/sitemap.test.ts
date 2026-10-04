// Sitemap entries (FIRE's cases). The oracles are written by hand, not computed by the same rule.
import { getBlogSitemapEntries } from "@softure-ai/blog/server";
import { describe, expect, it } from "vitest";
import { buildText, ROUTES } from "./support.js";

describe("getBlogSitemapEntries", () => {
  it("lists nothing for an empty blog, not even the listing (it is noindex)", () => {
    expect(getBlogSitemapEntries({ articles: [], terms: [], routes: ROUTES, methodPath: null })).toEqual([]);
  });

  it("dates an article by its update, else its publication; the listing by the newest of them", () => {
    const entries = getBlogSitemapEntries({
      articles: [
        buildText("a", { publishedAt: new Date("2026-10-01T08:00:00Z"), updatedAt: new Date("2026-10-05T09:00:00Z") }),
        buildText("b", { publishedAt: new Date("2026-10-03T10:00:00Z"), isPillar: true }),
      ],
      terms: [],
      routes: ROUTES,
      methodPath: null,
    });
    expect(entries).toEqual([
      { path: "/blog", lastModified: new Date("2026-10-05T09:00:00Z"), priority: 0.7 },
      { path: "/blog/a", lastModified: new Date("2026-10-05T09:00:00Z"), priority: 0.6 },
      { path: "/blog/b", lastModified: new Date("2026-10-03T10:00:00Z"), priority: 0.7 },
    ]);
  });

  it("lists terms under the glossary with its hub; without articles there is no listing", () => {
    const entries = getBlogSitemapEntries({
      articles: [],
      terms: [buildText("etf", { kind: "term", cluster: null, updatedAt: new Date("2026-10-04T12:00:00Z") })],
      routes: ROUTES,
      methodPath: null,
    });
    expect(entries).toEqual([
      { path: "/blog/glossary", lastModified: new Date("2026-10-04T12:00:00Z"), priority: 0.5 },
      { path: "/blog/glossary/etf", lastModified: new Date("2026-10-04T12:00:00Z"), priority: 0.5 },
    ]);
  });

  it("follows the app's routes and adds the method page without a date when it is mounted", () => {
    const entries = getBlogSitemapEntries({
      articles: [buildText("a")],
      terms: [],
      routes: { index: "/articles", glossary: "/terms", method: "/about/method", rss: "/articles/feed.xml" },
      methodPath: "/about/method",
    });
    expect(entries).toEqual([
      { path: "/articles", lastModified: new Date("2026-10-01T08:00:00Z"), priority: 0.7 },
      { path: "/articles/a", lastModified: new Date("2026-10-01T08:00:00Z"), priority: 0.6 },
      { path: "/about/method", priority: 0.3 },
    ]);
  });

  it("refuses a published text without a publication date instead of inventing one", () => {
    expect(() => getBlogSitemapEntries({ articles: [buildText("a", { publishedAt: null })], terms: [], routes: ROUTES, methodPath: null })).toThrow(
      "requirePublishedAt: text a has no published_at; discovery takes published texts only",
    );
  });
});

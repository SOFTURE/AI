// The sitemap from the app's entries and contributors.
import { buildSitemap, type SitemapContributor } from "@softure-ai/seo";
import { describe, expect, it } from "vitest";
import { createSettings } from "./support.js";

const CHANGED = new Date("2026-10-04T12:00:00Z");

describe("buildSitemap", () => {
  it("is empty when the app lists nothing", async () => {
    expect(await buildSitemap(createSettings())).toEqual([]);
  });

  it("lists the app's entries as absolute canonical URLs, lastmod only when given", async () => {
    // No invented date: an entry without lastModified has none (the roadmap's "never the build time").
    const settings = createSettings({
      origin: "https://www.example.com",
      canonical: { host: "apex" },
      sitemap: { entries: [{ path: "/", priority: 1 }, { path: "/pricing/", lastModified: CHANGED, changeFrequency: "monthly" }] },
    });
    expect(await buildSitemap(settings)).toEqual([
      { url: "https://example.com/", priority: 1 },
      { url: "https://example.com/pricing", lastModified: CHANGED, changeFrequency: "monthly" },
    ]);
  });

  it("adds each contributor's entries after the app's, in order, sync or async", async () => {
    const articles: SitemapContributor = () => Promise.resolve([{ path: "/blog/a", lastModified: CHANGED }]);
    const glossary: SitemapContributor = ({ siteOrigin }) => [{ path: `/glossary/${new URL(siteOrigin).hostname}` }];
    const settings = createSettings({ sitemap: { entries: [{ path: "/" }], contributors: [articles, glossary] } });
    expect((await buildSitemap(settings)).map((entry) => entry.url)).toEqual([
      "https://app.example.com/",
      "https://app.example.com/blog/a",
      "https://app.example.com/glossary/app.example.com",
    ]);
  });

  it("keeps the first entry of a URL listed twice", async () => {
    const settings = createSettings({ sitemap: { entries: [{ path: "/blog", priority: 0.8 }], contributors: [() => [{ path: "/blog/", priority: 0.1 }]] } });
    expect(await buildSitemap(settings)).toEqual([{ url: "https://app.example.com/blog", priority: 0.8 }]);
  });

  it("leaves out a failing contributor, logs it and serves the rest", async () => {
    const logs: string[] = [];
    const failing: SitemapContributor = () => Promise.reject(new Error("ECONNREFUSED"));
    const throwing: SitemapContributor = () => {
      throw new TypeError("boom");
    };
    const settings = createSettings({ sitemap: { entries: [{ path: "/" }], contributors: [failing, throwing, () => [{ path: "/ok" }]] } });
    const entries = await buildSitemap(settings, { log: (message) => logs.push(message) });
    expect(entries.map((entry) => entry.url)).toEqual(["https://app.example.com/", "https://app.example.com/ok"]);
    expect(logs).toEqual([
      "sitemap: contributor 0 failed, its entries are left out: Error",
      "sitemap: contributor 1 failed, its entries are left out: TypeError",
    ]);
  });

  it("leaves out a contributor's entry that is not a path on the site, and a result that is not a list", async () => {
    const logs: string[] = [];
    const contributors = [
      () => [{ path: "https://evil.example/x" }, { path: "/fine" }],
      (() => ({ path: "/x" })) as unknown as SitemapContributor,
    ];
    const entries = await buildSitemap(createSettings({ sitemap: { contributors } }), { log: (message) => logs.push(message) });
    expect(entries).toEqual([{ url: "https://app.example.com/fine" }]);
    expect(logs).toEqual([
      "sitemap: contributor 1 failed, its entries are left out: TypeError",
      'sitemap: entry "https://evil.example/x" is not a path on the site and is left out',
    ]);
  });
});

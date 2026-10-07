// The feed route and the sitemap contributor over a published PGlite blog. Next's request scope is
// replaced as in pages.test.tsx: the config and the database are the test's, the data cache calls through.
import type { SoftureConfig } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import { blogSitemap } from "@softure-ai/blog";
import { serveBlogRss } from "@softure-ai/blog/next";
import { seo } from "@softure-ai/seo";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NOW, type TestBlog } from "../support.js";
import { createPublishedBlog } from "./support.js";

const scope = vi.hoisted((): { config: SoftureConfig | undefined; db: Queryable | undefined } => ({ config: undefined, db: undefined }));

vi.mock("@softure-ai/core/next", () => ({
  getSoftureConfig: () => {
    if (scope.config === undefined) throw new Error("test: no config registered");
    return scope.config;
  },
}));
vi.mock("@softure-ai/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@softure-ai/db")>()),
  getConfiguredDatabase: () => Promise.resolve({ db: scope.db }),
}));
vi.mock("next/cache", () => ({ unstable_cache: <T,>(read: T) => read }));

let test: TestBlog;

beforeEach(async () => {
  test = await createPublishedBlog();
  scope.config = test.config;
  scope.db = test.ctx.db;
});
afterEach(async () => {
  scope.config = undefined;
  scope.db = undefined;
  await test.database.close();
});

describe("serveBlogRss", () => {
  it("answers the feed of the published articles and terms on the app's origin", async () => {
    const response = await serveBlogRss();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/rss+xml; charset=utf-8");
    const xml = await response.text();
    expect(xml).toContain("<title>Blog | Example</title>");
    expect(xml).toContain('<atom:link href="https://app.example.com/blog/rss.xml" rel="self" type="application/rss+xml"/>');
    const links = [...xml.matchAll(/<item>\s*<title>[^<]*<\/title>\s*<link>([^<]*)<\/link>/g)].map((match) => match[1]);
    expect(links.sort()).toEqual([
      "https://app.example.com/blog/bond-basics",
      "https://app.example.com/blog/glossary/expense-ratio",
      "https://app.example.com/blog/index-funds",
      "https://app.example.com/blog/renamed-after",
      "https://app.example.com/blog/taxes",
    ]);
    expect(xml).toContain("<category>Investing basics</category>");
    expect(xml).toContain("<category>Glossary</category>");
  });

  it("answers 503 with a retry hint, not an empty feed, when the texts cannot be read", async () => {
    scope.db = { select: () => { throw new Error("connect ECONNREFUSED 127.0.0.1:5432"); } } as unknown as Queryable;
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const response = await serveBlogRss();
      expect(response.status).toBe(503);
      expect(response.headers.get("retry-after")).toBe("300");
      expect(await response.text()).toBe("The feed is unavailable for a moment. Try again in a few minutes.");
      expect(logged).toHaveBeenCalledTimes(1);
      expect(String(logged.mock.calls[0]?.[0])).toMatch(/^blog: the RSS feed could not read the texts: /);
    } finally {
      logged.mockRestore();
    }
  });
});

describe("serveBlogRss under seo's canonical rule", () => {
  it("links each text by seo's host and trailing-slash rule, as the pages declare it", async () => {
    await test.database.close();
    test = await createPublishedBlog({}, [seo({ origin: "https://www.example.org", canonical: { host: "apex", trailingSlash: true } })]);
    scope.config = test.config;
    scope.db = test.ctx.db;
    const xml = await (await serveBlogRss()).text();
    expect(xml).toContain("<link>https://example.org/blog/index-funds/</link>");
    expect(xml).toContain('<atom:link href="https://example.org/blog/rss.xml" rel="self" type="application/rss+xml"/>');
    expect(xml).not.toContain("app.example.com");
  });
});

describe("blogSitemap", () => {
  it("lists the listing, the articles, the glossary, its terms and the method page with their real dates", async () => {
    const entries = await blogSitemap()();
    expect(entries).toEqual([
      { path: "/blog", lastModified: NOW, priority: 0.7 },
      { path: "/blog/bond-basics", lastModified: NOW, priority: 0.6 },
      { path: "/blog/index-funds", lastModified: NOW, priority: 0.7 },
      // A rename moves no content date: the slug is outside the content hash.
      { path: "/blog/renamed-after", lastModified: NOW, priority: 0.6 },
      { path: "/blog/taxes", lastModified: NOW, priority: 0.6 },
      { path: "/blog/glossary", lastModified: NOW, priority: 0.5 },
      { path: "/blog/glossary/expense-ratio", lastModified: NOW, priority: 0.5 },
      { path: "/blog/how-we-write", priority: 0.3 },
    ]);
  });

  it("reads the config it was given instead of the registered one", async () => {
    const config = test.config;
    scope.config = undefined;
    expect((await blogSitemap(config)()).map((entry) => entry.path)).toContain("/blog/index-funds");
  });
});

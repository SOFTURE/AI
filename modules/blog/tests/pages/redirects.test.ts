// 301 and 410 for text addresses (FIRE's blog-route cases), the decision cache and the 410 page.
import type { BlogArticleKind, BlogArticleStatus } from "@softure-ai/blog";
import { buildGonePage, createCachedBlogPathDecider, decideBlogPath, type BlogPathLookup, type BlogRoutes } from "@softure-ai/blog/server";
import { describe, expect, it, vi } from "vitest";

const ROUTES: BlogRoutes = { index: "/blog", glossary: "/blog/glossary", method: "/blog/how-we-write" };

type Row = { status: BlogArticleStatus; kind: BlogArticleKind };

function createLookup(texts: Record<string, Row>, history: Record<string, string> = {}) {
  return {
    findText: vi.fn((slug: string) => Promise.resolve(texts[slug] ?? null)),
    findRedirect: vi.fn((slug: string) => Promise.resolve(history[slug] ?? null)),
  } satisfies BlogPathLookup;
}

const article = (slug: string) => ({ kind: "article" as const, slug });
const term = (slug: string) => ({ kind: "term" as const, slug });

describe("decideBlogPath", () => {
  it("passes a published text on to its page", async () => {
    expect(await decideBlogPath(article("a"), ROUTES, createLookup({ a: { status: "published", kind: "article" } }))).toEqual({ kind: "pass" });
    expect(await decideBlogPath(term("t"), ROUTES, createLookup({ t: { status: "published", kind: "term" } }))).toEqual({ kind: "pass" });
  });

  it("answers 410 for a withdrawn article and a withdrawn term", async () => {
    expect(await decideBlogPath(article("a"), ROUTES, createLookup({ a: { status: "withdrawn", kind: "article" } }))).toEqual({ kind: "gone" });
    expect(await decideBlogPath(term("t"), ROUTES, createLookup({ t: { status: "withdrawn", kind: "term" } }))).toEqual({ kind: "gone" });
  });

  it("redirects an old slug to the current path of its text", async () => {
    const lookup = createLookup({ new: { status: "published", kind: "article" }, "new-term": { status: "published", kind: "term" } }, { old: "new", "old-term": "new-term" });
    expect(await decideBlogPath(article("old"), ROUTES, lookup)).toEqual({ kind: "redirect", path: "/blog/new" });
    expect(await decideBlogPath(term("old-term"), ROUTES, lookup)).toEqual({ kind: "redirect", path: "/blog/glossary/new-term" });
    expect(await decideBlogPath(article("old-term"), ROUTES, lookup)).toEqual({ kind: "redirect", path: "/blog/glossary/new-term" });
  });

  it("lets a current text win over the history", async () => {
    expect(await decideBlogPath(article("a"), ROUTES, createLookup({ a: { status: "published", kind: "article" } }, { a: "b" }))).toEqual({ kind: "pass" });
  });

  it("redirects a published text found under the other kind's path to its own", async () => {
    const lookup = createLookup({ t: { status: "published", kind: "term" }, a: { status: "published", kind: "article" } });
    expect(await decideBlogPath(article("t"), ROUTES, lookup)).toEqual({ kind: "redirect", path: "/blog/glossary/t" });
    expect(await decideBlogPath(term("a"), ROUTES, lookup)).toEqual({ kind: "redirect", path: "/blog/a" });
  });

  it("passes unknown slugs, drafts and other-kind texts that are not published: the page answers 404", async () => {
    const lookup = createLookup({ d: { status: "draft", kind: "article" }, w: { status: "withdrawn", kind: "term" } }, { gone: "missing" });
    expect(await decideBlogPath(article("x"), ROUTES, lookup)).toEqual({ kind: "pass" });
    expect(await decideBlogPath(article("d"), ROUTES, lookup)).toEqual({ kind: "pass" });
    expect(await decideBlogPath(article("w"), ROUTES, lookup)).toEqual({ kind: "pass" });
    expect(await decideBlogPath(article("gone"), ROUTES, lookup)).toEqual({ kind: "pass" });
  });
});

describe("createCachedBlogPathDecider", () => {
  it("keeps a decision for the TTL, then asks again", async () => {
    let now = 0;
    const lookup = createLookup({ a: { status: "withdrawn", kind: "article" } });
    const decide = createCachedBlogPathDecider(ROUTES, lookup, { ttlMs: 1000, now: () => now });
    await decide(article("a"));
    await decide(article("a"));
    expect(lookup.findText).toHaveBeenCalledTimes(1);
    now = 1001;
    await decide(article("a"));
    expect(lookup.findText).toHaveBeenCalledTimes(2);
  });

  it("keeps article and term decisions apart", async () => {
    const lookup = createLookup({ a: { status: "withdrawn", kind: "article" } });
    const decide = createCachedBlogPathDecider(ROUTES, lookup);
    expect(await decide(article("a"))).toEqual({ kind: "gone" });
    expect(await decide(term("a"))).toEqual({ kind: "pass" });
  });

  it("passes a request on when the lookup fails, reports it and does not remember it", async () => {
    const onError = vi.fn();
    const lookup: BlogPathLookup = { findText: vi.fn(() => Promise.reject(new Error("connection refused"))), findRedirect: vi.fn(() => Promise.resolve(null)) };
    const decide = createCachedBlogPathDecider(ROUTES, lookup, { onError });
    expect(await decide(article("a"))).toEqual({ kind: "pass" });
    await decide(article("a"));
    expect(lookup.findText).toHaveBeenCalledTimes(2);
    expect(onError).toHaveBeenCalledWith('@softure-ai/blog proxy: lookup of the article "a" failed: connection refused');
  });

  it("drops the oldest decision past the limit", async () => {
    const lookup = createLookup({});
    const decide = createCachedBlogPathDecider(ROUTES, lookup, { maxEntries: 2 });
    for (const slug of ["a", "b", "c", "b", "a"]) await decide(article(slug));
    expect(lookup.findText).toHaveBeenCalledTimes(4);
  });
});

describe("buildGonePage", () => {
  it("is a noindex page in the app's language with escaped copy and a link to the listing", () => {
    const html = buildGonePage({ title: "Gone <now>", heading: "Withdrawn", body: "Sorry & bye.", link: "Blog" }, { lang: "en", indexPath: "/blog" });
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('<meta name="robots" content="noindex">');
    expect(html).toContain("<title>Gone &lt;now&gt;</title>");
    expect(html).toContain('<p>Sorry &amp; bye. <a href="/blog">Blog</a></p>');
    expect(html).not.toContain("<script");
  });
});

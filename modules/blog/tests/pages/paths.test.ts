// Paths of the blog's pages: article and term addresses, reserved slugs, and which text a request names.
import { getArticlePath, getReservedSlugs, getTermPath, matchBlogPath, normalizeRoute, type BlogRoutes } from "@softure-ai/blog/server";
import { describe, expect, it } from "vitest";

const ROUTES: BlogRoutes = { index: "/blog", glossary: "/blog/glossary", method: "/blog/how-we-write" };

describe("blog paths", () => {
  it("puts articles under the listing and terms under the glossary", () => {
    expect(getArticlePath(ROUTES, "index-funds")).toBe("/blog/index-funds");
    expect(getTermPath(ROUTES, "expense-ratio")).toBe("/blog/glossary/expense-ratio");
    expect(getArticlePath({ ...ROUTES, index: "/" }, "index-funds")).toBe("/index-funds");
  });

  it("drops a trailing slash from a route, keeping the root", () => {
    expect(normalizeRoute("/articles/")).toBe("/articles");
    expect(normalizeRoute("/")).toBe("/");
  });

  it("reserves the static pages one segment under the listing, the method page only when mounted", () => {
    expect(getReservedSlugs(ROUTES, { methodPage: false, reservedSlugs: [] })).toEqual(["glossary"]);
    expect(getReservedSlugs(ROUTES, { methodPage: true, reservedSlugs: ["about", "glossary"] })).toEqual(["about", "glossary", "how-we-write"]);
    expect(getReservedSlugs({ index: "/blog", glossary: "/glossary", method: "/blog/a/b" }, { methodPage: true, reservedSlugs: [] })).toEqual([]);
  });

  it.each([
    ["/blog/index-funds", { kind: "article", slug: "index-funds" }],
    ["/blog/glossary/expense-ratio", { kind: "term", slug: "expense-ratio" }],
    ["/blog", null],
    ["/blog/", null],
    ["/blog/glossary", null],
    ["/blog/how-we-write", null],
    ["/blog/a/b", null],
    ["/blog/index-funds/opengraph-image", null],
    ["/blog/glossary/expense-ratio/opengraph-image", null],
    ["/blog/Index-Funds", null],
    ["/blog/index--funds", null],
    [`/blog/${"a".repeat(101)}`, null],
    ["/pricing", null],
    ["/blogger/index-funds", null],
  ])("matches %s as %j", (pathname, match) => {
    expect(matchBlogPath(pathname, ROUTES, ["glossary", "how-we-write"])).toEqual(match);
  });

  it("matches a glossary outside the listing", () => {
    const routes = { ...ROUTES, glossary: "/glossary" };
    expect(matchBlogPath("/glossary/expense-ratio", routes, [])).toEqual({ kind: "term", slug: "expense-ratio" });
  });
});

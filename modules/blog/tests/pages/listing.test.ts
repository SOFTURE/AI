// The listing's order, cluster labels, crumbs, glossary order and dates (FIRE's blog-page cases).
import { formatDay, getArticleCrumbs, getArticleDates, getClusterLabel, getTermCrumbs, groupByCluster, sortTerms, splitClusterLead, type BlogRoutes } from "@softure-ai/blog/server";
import { describe, expect, it } from "vitest";
import { buildStoredArticle, buildStoredTerm } from "../support.js";

const ROUTES: BlogRoutes = { index: "/blog", glossary: "/blog/glossary", method: "/blog/how-we-write", rss: "/blog/rss.xml" };
const LABELS = { blog: "Blog", glossary: "Glossary", cluster: (cluster: string) => `#${cluster}` };

describe("article dates", () => {
  it("takes the publication day in the app's time zone, not in UTC", () => {
    expect(getArticleDates(buildStoredArticle(), "Europe/Warsaw").published).toBe("2026-09-15");
    expect(getArticleDates(buildStoredArticle(), "UTC").published).toBe("2026-09-14");
  });

  it("shows the update day only when it differs from the publication day", () => {
    expect(getArticleDates(buildStoredArticle({ updatedAt: new Date("2026-09-15T10:00:00Z") }), "Europe/Warsaw").updated).toBeNull();
    expect(getArticleDates(buildStoredArticle({ updatedAt: new Date("2026-10-02T08:00:00Z") }), "Europe/Warsaw")).toEqual({
      published: "2026-09-15",
      updated: "2026-10-02",
      currentAsOf: "2026-10-01",
    });
  });

  it("treats an article without a publication date as a bug", () => {
    expect(() => getArticleDates(buildStoredArticle({ publishedAt: null }), "UTC")).toThrow("getArticleDates: article index-funds has no published_at");
  });

  it("formats a day in the locale without shifting it", () => {
    expect(formatDay("2026-10-04", "en")).toBe("October 4, 2026");
    expect(formatDay("2026-10-04", "pl")).toBe("4 pa\u017adziernika 2026");
  });
});

describe("clusters", () => {
  it("labels a cluster from the app's labels in the locale, else from its key", () => {
    const labels = { "investing-basics": { en: "Investing basics", pl: "Podstawy" }, taxes: { en: "Taxes" } };
    expect(getClusterLabel("investing-basics", labels, "pl")).toBe("Podstawy");
    expect(getClusterLabel("taxes", labels, "pl")).toBe("Taxes");
    expect(getClusterLabel("early-retirement", labels, "en")).toBe("Early retirement");
  });

  it("orders groups by their newest text, texts without a cluster last", () => {
    const articles = [
      buildStoredArticle({ id: "a", slug: "a", cluster: "taxes" }),
      buildStoredArticle({ id: "b", slug: "b", cluster: null }),
      buildStoredArticle({ id: "c", slug: "c", cluster: "investing-basics" }),
      buildStoredArticle({ id: "d", slug: "d", cluster: "taxes" }),
    ];
    const groups = groupByCluster(articles, (cluster) => cluster.toUpperCase(), "Other");
    expect(groups.map((group) => [group.cluster, group.label, group.rest.map((article) => article.slug)])).toEqual([
      ["taxes", "TAXES", ["a", "d"]],
      ["investing-basics", "INVESTING-BASICS", ["c"]],
      [null, "Other", ["b"]],
    ]);
    expect(groupByCluster([], (cluster) => cluster, "Other")).toEqual([]);
  });

  it("puts the pillar first as the lead and keeps the rest in order", () => {
    const articles = [buildStoredArticle({ id: "a" }), buildStoredArticle({ id: "b", isPillar: true }), buildStoredArticle({ id: "c" })];
    const { lead, rest } = splitClusterLead(articles);
    expect(lead?.id).toBe("b");
    expect(rest.map((article) => article.id)).toEqual(["a", "c"]);
    expect(splitClusterLead([buildStoredArticle()]).lead).toBeNull();
  });
});

describe("crumbs and terms", () => {
  it("leads an article from the listing through its cluster", () => {
    expect(getArticleCrumbs(buildStoredArticle(), ROUTES, LABELS)).toEqual([
      { name: "Blog", path: "/blog" },
      { name: "#investing-basics", path: "/blog#cluster-investing-basics" },
      { name: "Index funds in plain words", path: "/blog/index-funds" },
    ]);
    expect(getArticleCrumbs(buildStoredArticle({ cluster: null }), ROUTES, LABELS).map((crumb) => crumb.name)).toEqual(["Blog", "Index funds in plain words"]);
  });

  it("leads a term from the listing through the glossary", () => {
    expect(getTermCrumbs(buildStoredTerm(), ROUTES, LABELS)).toEqual([
      { name: "Blog", path: "/blog" },
      { name: "Glossary", path: "/blog/glossary" },
      { name: "Expense ratio", path: "/blog/glossary/expense-ratio" },
    ]);
  });

  it("sorts terms in the locale's order", () => {
    const terms = [buildStoredTerm({ title: "Zysk" }), buildStoredTerm({ title: "\u0141ad" }), buildStoredTerm({ title: "Limit" })];
    expect(sortTerms(terms, "pl").map((term) => term.title)).toEqual(["Limit", "\u0141ad", "Zysk"]);
  });
});

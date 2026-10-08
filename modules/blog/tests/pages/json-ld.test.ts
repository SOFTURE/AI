// Structured data of the pages: the visible days, absolute URLs, FAQ only with questions, safe serialization.
import { defineSoftureConfig, getSiteUrls, type AnySoftureModule } from "@softure-ai/core";
import { getArticleCrumbs, getArticleJsonLd, getGlossaryJsonLd, getTermCrumbs, getTermJsonLd, serializeJsonLd, type JsonLdContext } from "@softure-ai/blog/server";
import { seo } from "@softure-ai/seo";
import { describe, expect, it } from "vitest";
import { buildStoredArticle, buildStoredTerm } from "../support.js";

function getUrls(modules: readonly AnySoftureModule[] = []): JsonLdContext["urls"] {
  return getSiteUrls(defineSoftureConfig({ locale: "en", timezone: "UTC", appOrigin: "https://example.com", modules: [...modules] }));
}

const CTX: JsonLdContext = {
  urls: getUrls(),
  routes: { index: "/blog", glossary: "/blog/glossary", method: "/blog/how-we-write", rss: "/blog/rss.xml" },
  locale: "en",
  timezone: "Europe/Warsaw",
  brand: "Example",
};
const LABELS = { blog: "Blog", glossary: "Glossary", cluster: () => "Investing basics" };

function getGraph(article = buildStoredArticle(), ctx = CTX): Record<string, unknown>[] {
  return getArticleJsonLd(article, getArticleCrumbs(article, ctx.routes, LABELS), ctx)["@graph"] as Record<string, unknown>[];
}

describe("JSON-LD output options", () => {
  it("writes the context's @id fragments and language, and the defaults without them", () => {
    const ctx: JsonLdContext = { ...CTX, ids: { article: "artykul", term: "termin", glossary: "slownik" }, language: "en-GB" };
    expect(getGraph(buildStoredArticle(), ctx)[0]).toMatchObject({ "@id": "https://example.com/blog/index-funds#artykul", inLanguage: "en-GB" });
    const term = buildStoredTerm();
    const [definedTerm] = getTermJsonLd(term, getTermCrumbs(term, ctx.routes, LABELS), ctx, "Glossary")["@graph"] as Record<string, unknown>[];
    expect(definedTerm).toMatchObject({
      "@id": "https://example.com/blog/glossary/expense-ratio#termin",
      inDefinedTermSet: { "@type": "DefinedTermSet", "@id": "https://example.com/blog/glossary#slownik", name: "Glossary" },
    });
    expect(getGlossaryJsonLd([term], ctx, "Glossary")).toMatchObject({ "@id": "https://example.com/blog/glossary#slownik", inLanguage: "en-GB" });
    expect(getGraph()[0]).toMatchObject({ "@id": "https://example.com/blog/index-funds#article", inLanguage: "en" });
  });
});

describe("article JSON-LD", () => {
  it("is a BlogPosting with the brand as author and publisher and the visible days", () => {
    const [posting] = getGraph(buildStoredArticle({ updatedAt: new Date("2026-10-02T08:00:00Z") }));
    expect(posting).toEqual({
      "@type": "BlogPosting",
      "@id": "https://example.com/blog/index-funds#article",
      mainEntityOfPage: "https://example.com/blog/index-funds",
      url: "https://example.com/blog/index-funds",
      headline: "Index funds in plain words",
      description: "What an index fund is and what it costs.",
      inLanguage: "en",
      datePublished: "2026-09-15",
      dateModified: "2026-10-02",
      author: { "@type": "Organization", name: "Example", url: "https://example.com/" },
      publisher: { "@type": "Organization", name: "Example", url: "https://example.com/" },
      image: "https://example.com/blog/index-funds/opengraph-image",
      citation: [{ "@type": "CreativeWork", name: "Fund factsheet", url: "https://example.com/factsheet" }],
    });
  });

  it("uses the publication day as dateModified when the content never changed, and leaves out a missing brand", () => {
    const [posting] = getGraph(buildStoredArticle({ sources: [] }), { ...CTX, brand: null });
    expect(posting?.dateModified).toBe("2026-09-15");
    expect(posting).not.toHaveProperty("author");
    expect(posting).not.toHaveProperty("citation");
  });

  it("lists the crumbs with absolute URLs from position 1", () => {
    expect(getGraph()[1]).toEqual({
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Blog", item: "https://example.com/blog" },
        { "@type": "ListItem", position: 2, name: "Investing basics", item: "https://example.com/blog#cluster-investing-basics" },
        { "@type": "ListItem", position: 3, name: "Index funds in plain words", item: "https://example.com/blog/index-funds" },
      ],
    });
  });

  it("adds an FAQPage only when the text has questions", () => {
    expect(getGraph()).toHaveLength(2);
    expect(getGraph(buildStoredArticle({ faq: [{ question: "Can I hold both?", answer: "Yes." }] }))[2]).toEqual({
      "@type": "FAQPage",
      mainEntity: [{ "@type": "Question", name: "Can I hold both?", acceptedAnswer: { "@type": "Answer", text: "Yes." } }],
    });
  });

  it("serializes so that no title can close the script tag", () => {
    const article = buildStoredArticle({ title: "</script><script>alert(1)</script>" });
    const text = serializeJsonLd(getArticleJsonLd(article, getArticleCrumbs(article, CTX.routes, LABELS), CTX));
    expect(text).not.toContain("</script>");
    expect(text).toContain("\\u003c/script>");
  });
});

describe("glossary JSON-LD", () => {
  it("puts a term in the glossary's set, with its forms as alternate names", () => {
    const term = buildStoredTerm();
    const [definition, crumbs] = getTermJsonLd(term, getTermCrumbs(term, CTX.routes, LABELS), CTX, "Glossary")["@graph"] as Record<string, unknown>[];
    expect(definition).toEqual({
      "@type": "DefinedTerm",
      "@id": "https://example.com/blog/glossary/expense-ratio#term",
      url: "https://example.com/blog/glossary/expense-ratio",
      name: "Expense ratio",
      description: "The yearly cost of a fund as a share of the money in it.",
      inLanguage: "en",
      alternateName: ["expense ratio"],
      inDefinedTermSet: { "@type": "DefinedTermSet", "@id": "https://example.com/blog/glossary#glossary", name: "Glossary" },
    });
    expect((crumbs?.itemListElement as unknown[]).length).toBe(3);
  });

  it("lists every term in the index's set", () => {
    expect(getGlossaryJsonLd([buildStoredTerm()], CTX, "Glossary")).toEqual({
      "@context": "https://schema.org",
      "@type": "DefinedTermSet",
      "@id": "https://example.com/blog/glossary#glossary",
      name: "Glossary",
      url: "https://example.com/blog/glossary",
      inLanguage: "en",
      hasDefinedTerm: [
        {
          "@type": "DefinedTerm",
          "@id": "https://example.com/blog/glossary/expense-ratio#term",
          name: "Expense ratio",
          description: "The yearly cost of a fund as a share of the money in it.",
          url: "https://example.com/blog/glossary/expense-ratio",
        },
      ],
    });
  });
});

describe("JSON-LD under seo's canonical rule", () => {
  // A canonical host that differs from appOrigin, and the trailing-slash rule.
  const SEO_CTX: JsonLdContext = { ...CTX, urls: getUrls([seo({ origin: "https://www.example.org", canonical: { host: "apex", trailingSlash: true } })]) };

  it("builds an article's URLs, crumbs and brand on seo's host with its trailing slash, and its image without one", () => {
    const article = buildStoredArticle();
    const [posting, crumbs] = getArticleJsonLd(article, getArticleCrumbs(article, SEO_CTX.routes, LABELS), SEO_CTX)["@graph"] as Record<string, unknown>[];
    expect(posting).toMatchObject({
      "@id": "https://example.org/blog/index-funds/#article",
      mainEntityOfPage: "https://example.org/blog/index-funds/",
      url: "https://example.org/blog/index-funds/",
      author: { url: "https://example.org/" },
      image: "https://example.org/blog/index-funds/opengraph-image",
    });
    expect(crumbs?.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Blog", item: "https://example.org/blog/" },
      { "@type": "ListItem", position: 2, name: "Investing basics", item: "https://example.org/blog/#cluster-investing-basics" },
      { "@type": "ListItem", position: 3, name: "Index funds in plain words", item: "https://example.org/blog/index-funds/" },
    ]);
  });

  it("builds a term's and the glossary's URLs on seo's host with its trailing slash", () => {
    const term = buildStoredTerm();
    const [definition] = getTermJsonLd(term, getTermCrumbs(term, SEO_CTX.routes, LABELS), SEO_CTX, "Glossary")["@graph"] as Record<string, unknown>[];
    expect(definition).toMatchObject({
      "@id": "https://example.org/blog/glossary/expense-ratio/#term",
      url: "https://example.org/blog/glossary/expense-ratio/",
      inDefinedTermSet: { "@id": "https://example.org/blog/glossary/#glossary" },
    });
    expect(getGlossaryJsonLd([term], SEO_CTX, "Glossary")).toMatchObject({ url: "https://example.org/blog/glossary/", "@id": "https://example.org/blog/glossary/#glossary" });
  });
});

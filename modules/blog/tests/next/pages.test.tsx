// The Next adapter's pages and metadata over a published PGlite blog. Next's request scope is
// replaced: the config comes from the test, the shared database is the test's, the data cache calls
// through and `notFound` throws.
import type { SoftureConfig } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import {
  buildArticleJsonLd,
  buildArticleMetadata,
  buildBlogIndexMetadata,
  buildGlossaryIndexMetadata,
  buildGlossaryJsonLd,
  buildMethodMetadata,
  buildTermJsonLd,
  buildTermMetadata,
  findArticlesLinkingTermFor,
  getBodyOptions,
  getPublishedArticles,
  getPublishedTerms,
  getTextBySlug,
  BlogArticlePage,
  BlogIndexPage,
  BlogMethodPage,
  generateArticleMetadata,
  generateBlogIndexMetadata,
  generateBlogStaticParams,
  generateGlossaryIndexMetadata,
  generateMethodMetadata,
  generateTermMetadata,
  GlossaryIndexPage,
  GlossaryTermPage,
} from "@softure-ai/blog/next";
import { findArticlesLinkingTerm, renderPageBody, runBlogPublish } from "@softure-ai/blog/server";
import { seo } from "@softure-ai/seo";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildArticleFile, type TestBlog } from "../support.js";
import { createPublishedBlog } from "./support.js";

const scope = vi.hoisted((): { config: SoftureConfig | undefined; db: Queryable | undefined } => ({ config: undefined, db: undefined }));

class NotFoundSignal extends Error {}

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
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new NotFoundSignal("not found");
  },
}));

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

const params = (slug: string) => ({ params: Promise.resolve({ slug }) });

async function render(page: Promise<React.ReactElement> | React.ReactElement): Promise<string> {
  return renderToStaticMarkup(await page);
}

describe("blog pages", () => {
  it("lists articles in clusters with the pillar as the lead card, and links the glossary", async () => {
    const html = await render(BlogIndexPage({ cta: <a href="/pricing">See plans</a> }));
    expect(html).toContain('<section id="cluster-investing-basics"');
    expect(html).toContain("Investing basics");
    expect(html).toMatch(/class="blog-card blog-card-lead" data-slug="index-funds".*Start here/s);
    expect(html).toContain('href="/blog/bond-basics"');
    expect(html).toContain("Other texts");
    expect(html).toContain('href="/blog/taxes"');
    expect(html).not.toContain("/blog/stale");
    expect(html).not.toContain("/blog/draft");
    expect(html).toContain('<a href="/pricing">See plans</a>');
    expect(html).toContain('<a href="/blog/glossary">Glossary</a>');
    expect(html).toContain("Example editorial team");
    expect(html).toContain('<a href="/blog/how-we-write">How our texts are made</a>');
    expect(html).toContain("Not investment advice.");
  });

  it("renders an article with dates, summary, contents, body, FAQ, sources, JSON-LD and the app's slots", async () => {
    const html = await render(BlogArticlePage({ ...params("index-funds"), cta: <p>Try it</p>, afterArticle: <form aria-label="Join" /> }));
    expect(html).toContain('<h1 class="blog-title">Index funds in plain words</h1>');
    expect(html).toContain('<time dateTime="2026-10-04">October 4, 2026</time>');
    expect(html).toContain('<time dateTime="2026-10-01">October 1, 2026</time>');
    expect(html).toContain("1 min read");
    expect(html).toContain("<h2 id=\"blog-summary\">In short</h2><p>Index funds are cheap and broad.</p>");
    expect(html).toContain('<a href="#costs">Costs</a>');
    expect(html).toContain('<a href="/blog/glossary/expense-ratio" class="blog-term">expense ratio</a>');
    expect(html).toContain("<dt>Is it safe?</dt><dd>It follows the market.</dd>");
    expect(html).toContain('<a href="https://example.com/factsheet" rel="noopener noreferrer" target="_blank">Fund factsheet</a>');
    expect(html).toContain('<a href="/blog#cluster-investing-basics">Investing basics</a>');
    expect(html).toContain('"@type":"BlogPosting"');
    expect(html).toContain('"@type":"FAQPage"');
    expect(html).toContain("<p>Try it</p>");
    expect(html).toContain('<form aria-label="Join"></form>');
  });

  it("puts \"read next\" between the app's two slots: the cluster's satellites under a pillar, then the newest", async () => {
    const html = await render(BlogArticlePage({ ...params("index-funds"), cta: <p>Try it</p>, afterArticle: <form aria-label="Join" /> }));
    const section = html.slice(html.indexOf('<section aria-labelledby="blog-related"'), html.indexOf("</section>", html.indexOf('aria-labelledby="blog-related"')));
    expect(section).toContain('<h2 id="blog-related">Read next</h2>');
    expect([...section.matchAll(/<h3><a href="([^"]+)">/g)].map((match) => match[1])).toEqual(["/blog/bond-basics", "/blog/renamed-after", "/blog/taxes"]);
    expect(html.indexOf("<p>Try it</p>")).toBeLessThan(html.indexOf('aria-labelledby="blog-related"'));
    expect(html.indexOf('aria-labelledby="blog-related"')).toBeLessThan(html.indexOf('<form aria-label="Join"></form>'));
  });

  it("answers 404 for a draft, a withdrawn text, a term and an unknown slug at the article path", async () => {
    for (const slug of ["draft", "stale", "expense-ratio", "missing"]) {
      await expect(BlogArticlePage(params(slug)), slug).rejects.toBeInstanceOf(NotFoundSignal);
      expect(await generateArticleMetadata(params(slug)), slug).toEqual({});
    }
  });

  it("gives an article absolute canonical and OG URLs, its days and a branded title", async () => {
    expect(await generateArticleMetadata(params("index-funds"))).toEqual({
      title: "Index funds in plain words | Example",
      description: "What an index fund is and what it costs.",
      robots: { index: true, follow: true },
      alternates: {
        canonical: "https://app.example.com/blog/index-funds",
        types: { "application/rss+xml": [{ url: "https://app.example.com/blog/rss.xml", title: "Blog | Example" }] },
      },
      openGraph: {
        type: "article",
        title: "Index funds in plain words",
        description: "What an index fund is and what it costs.",
        url: "https://app.example.com/blog/index-funds",
        locale: "en_US",
        publishedTime: "2026-10-04",
        modifiedTime: "2026-10-04",
        siteName: "Example",
      },
    });
    expect(generateBlogStaticParams()).toEqual([]);
  });

  it("links the feed from the listing", async () => {
    expect((await generateBlogIndexMetadata()).alternates).toEqual({
      canonical: "https://app.example.com/blog",
      types: { "application/rss+xml": [{ url: "https://app.example.com/blog/rss.xml", title: "Blog | Example" }] },
    });
  });

  it("keeps an empty listing and an empty glossary out of the index", async () => {
    expect((await generateBlogIndexMetadata()).robots).toEqual({ index: true, follow: true });
    expect((await generateGlossaryIndexMetadata()).robots).toEqual({ index: true, follow: true });
    await test.ctx.db.execute("UPDATE blog.articles SET status = 'withdrawn'");
    expect((await generateBlogIndexMetadata()).robots).toEqual({ index: false, follow: true });
    expect((await generateGlossaryIndexMetadata()).robots).toEqual({ index: false, follow: true });
    const html = await render(BlogIndexPage());
    expect(html).toContain("The first texts are on their way.");
    expect(html).not.toContain("blog-glossary-teaser");
  });

  it("lists the glossary with its terms and their set in JSON-LD", async () => {
    const html = await render(GlossaryIndexPage());
    expect(html).toContain('<a href="/blog/glossary/expense-ratio">Expense ratio</a>');
    expect(html).not.toContain("old-term");
    expect(html).toContain('"@type":"DefinedTermSet"');
  });

  it("renders a term with the articles that link it, without linking itself", async () => {
    const html = await render(GlossaryTermPage(params("expense-ratio")));
    expect(html).toContain('<h1 class="blog-title">Expense ratio</h1>');
    expect(html).toContain('<h2 id="blog-explained-in">Explained in these texts</h2><ul><li><a href="/blog/index-funds">Index funds in plain words</a></li></ul>');
    expect(html).not.toContain('class="blog-term"');
    expect(html).toContain('"@type":"DefinedTerm"');
    expect(html).toContain('<a href="/blog/glossary">All terms</a>');
    expect((await generateTermMetadata(params("expense-ratio"))).alternates).toEqual({ canonical: "https://app.example.com/blog/glossary/expense-ratio" });
    await expect(GlossaryTermPage(params("index-funds"))).rejects.toBeInstanceOf(NotFoundSignal);
    await expect(GlossaryTermPage(params("old-term"))).rejects.toBeInstanceOf(NotFoundSignal);
  });

  it("shows the method page only when the app mounts it", async () => {
    expect(await render(BlogMethodPage())).toContain("<h2 id=\"checks-heading\">Checks before publishing</h2>");
    await test.database.close();
    test = await createPublishedBlog({ methodPage: false });
    scope.config = test.config;
    scope.db = test.ctx.db;
    expect(() => BlogMethodPage()).toThrow(NotFoundSignal);
    expect(await render(BlogIndexPage())).not.toContain("how-we-write");
  });
});

describe("builders for an app's own pages", () => {
  async function readText(slug: string) {
    const text = await getTextBySlug(test.config, slug);
    if (text === null) throw new Error(`test: no text ${slug}`);
    return text;
  }

  it("give the metadata the ready-made pages give, without reading the database", async () => {
    const [article, term] = [await readText("index-funds"), await readText("expense-ratio")];
    const expected = {
      article: await generateArticleMetadata(params("index-funds")),
      term: await generateTermMetadata(params("expense-ratio")),
      index: await generateBlogIndexMetadata(),
      glossary: await generateGlossaryIndexMetadata(),
      method: generateMethodMetadata(),
    };
    scope.db = undefined;
    expect(buildArticleMetadata(test.config, article)).toEqual(expected.article);
    expect(buildTermMetadata(test.config, term)).toEqual(expected.term);
    expect(buildBlogIndexMetadata(test.config, { isEmpty: false })).toEqual(expected.index);
    expect(buildGlossaryIndexMetadata(test.config, { isEmpty: false })).toEqual(expected.glossary);
    expect(buildMethodMetadata(test.config)).toEqual(expected.method);
    expect(buildBlogIndexMetadata(test.config, { isEmpty: true }).robots).toEqual({ index: false, follow: true });
  });

  it("give the JSON-LD the ready-made pages embed, serialized for a script tag", async () => {
    const [article, term, terms] = [await readText("index-funds"), await readText("expense-ratio"), await getPublishedTerms(test.config)];
    const pages = {
      article: await render(BlogArticlePage(params("index-funds"))),
      term: await render(GlossaryTermPage(params("expense-ratio"))),
      glossary: await render(GlossaryIndexPage()),
    };
    scope.db = undefined;
    const script = (json: string | null) => `<script type="application/ld+json">${String(json)}</script>`;
    expect(pages.article).toContain(script(buildArticleJsonLd(test.config, article)));
    expect(pages.term).toContain(script(buildTermJsonLd(test.config, term)));
    expect(pages.glossary).toContain(script(buildGlossaryJsonLd(test.config, terms)));
    expect((JSON.parse(buildArticleJsonLd(test.config, article)) as { "@graph": unknown[] })["@graph"][0]).toMatchObject({ "@type": "BlogPosting", url: "https://app.example.com/blog/index-funds" });
    expect(buildGlossaryJsonLd(test.config, [])).toBeNull();
    expect(buildArticleJsonLd(test.config, { ...article, title: "</script><b>" })).not.toContain("</script>");
  });

  it("list the articles that link a term exactly as the term page does, without reading the database", async () => {
    const [articles, terms] = [await getPublishedArticles(test.config), await getPublishedTerms(test.config)];
    const page = await render(GlossaryTermPage(params("expense-ratio")));
    scope.db = undefined;
    const linking = findArticlesLinkingTermFor(test.config, { articles, termSlug: "expense-ratio", terms });
    expect(linking.map((article) => article.slug)).toEqual(["index-funds"]);
    expect(page).toContain('<li><a href="/blog/index-funds">Index funds in plain words</a></li>');
    expect(linking).toEqual(findArticlesLinkingTerm(articles, "expense-ratio", getBodyOptions(test.config, terms)));
    expect(findArticlesLinkingTermFor(test.config, { articles, termSlug: "expense-ratio", terms: [] })).toEqual([]);
    expect(findArticlesLinkingTermFor(test.config, { articles: [], termSlug: "expense-ratio", terms })).toEqual([]);
  });

  it("give the body input the article page renders with", async () => {
    const [article, terms] = [await readText("index-funds"), await getPublishedTerms(test.config)];
    const page = await render(BlogArticlePage(params("index-funds")));
    scope.db = undefined;
    const body = renderPageBody<React.ReactNode>(article, getBodyOptions(test.config, terms));
    expect(body.linkedTerms).toEqual(["expense-ratio"]);
    expect(body.html).toContain('<a href="/blog/glossary/expense-ratio" class="blog-term">expense ratio</a>');
    expect(page).toContain(String(body.html));
  });
});

describe("builders with an adopting site's output options", () => {
  // Fragments, anchors, language tags and a term title an app published before it adopted the module.
  beforeEach(async () => {
    await test.database.close();
    test = await createPublishedBlog({
      jsonLd: { ids: { article: "artykul", term: "termin", glossary: "slownik" } },
      anchors: { cluster: "klaster" },
      locales: { en: { bcp47: "en-GB", openGraph: "en_GB" } },
      messages: { en: { glossary: { termTitleWithBrand: "{title} | {brand} glossary" } } },
    });
    scope.config = test.config;
    scope.db = test.ctx.db;
  });

  async function readText(slug: string) {
    const text = await getTextBySlug(test.config, slug);
    if (text === null) throw new Error(`test: no text ${slug}`);
    return text;
  }

  it("write the configured @id fragments, cluster anchor and inLanguage into the JSON-LD", async () => {
    const [article, term, terms] = [await readText("index-funds"), await readText("expense-ratio"), await getPublishedTerms(test.config)];
    const [posting, crumbs] = (JSON.parse(buildArticleJsonLd(test.config, article)) as { "@graph": Record<string, unknown>[] })["@graph"];
    expect(posting).toMatchObject({ "@id": "https://app.example.com/blog/index-funds#artykul", inLanguage: "en-GB" });
    expect(crumbs?.itemListElement).toContainEqual({ "@type": "ListItem", position: 2, name: "Investing basics", item: "https://app.example.com/blog#klaster-investing-basics" });
    const [definedTerm] = (JSON.parse(buildTermJsonLd(test.config, term)) as { "@graph": Record<string, unknown>[] })["@graph"];
    expect(definedTerm).toMatchObject({
      "@id": "https://app.example.com/blog/glossary/expense-ratio#termin",
      inLanguage: "en-GB",
      inDefinedTermSet: { "@type": "DefinedTermSet", "@id": "https://app.example.com/blog/glossary#slownik", name: "Glossary" },
    });
    const glossary = JSON.parse(String(buildGlossaryJsonLd(test.config, terms))) as Record<string, unknown>;
    expect(glossary).toMatchObject({ "@id": "https://app.example.com/blog/glossary#slownik", inLanguage: "en-GB" });
    expect(glossary.hasDefinedTerm).toEqual([expect.objectContaining({ "@id": "https://app.example.com/blog/glossary/expense-ratio#termin" })]);
  });

  it("anchor the listing's sections and the article's crumb with the configured prefix", async () => {
    const listing = await render(BlogIndexPage());
    expect(listing).toContain('<section id="klaster-investing-basics" aria-labelledby="klaster-investing-basics-heading"');
    expect(listing).toContain('aria-labelledby="klaster-other-heading"');
    expect(listing).not.toContain("cluster-");
    expect(await render(BlogArticlePage(params("index-funds")))).toContain('<a href="/blog#klaster-investing-basics">Investing basics</a>');
  });

  it("write the configured og:locale and title a term by its own message", async () => {
    const [article, term] = [await readText("index-funds"), await readText("expense-ratio")];
    expect(buildArticleMetadata(test.config, article)).toMatchObject({ title: "Index funds in plain words | Example", openGraph: { locale: "en_GB" } });
    expect(buildTermMetadata(test.config, term)).toMatchObject({ title: "Expense ratio | Example glossary", openGraph: { locale: "en_GB", title: "Expense ratio" } });
    expect(buildGlossaryIndexMetadata(test.config, { isEmpty: false }).title).toBe("Glossary | Example");
  });
});

describe("blog pages under seo's canonical rule", () => {
  // A canonical host that differs from appOrigin (https://app.example.com), and the trailing-slash rule.
  beforeEach(async () => {
    await test.database.close();
    test = await createPublishedBlog({}, [seo({ origin: "https://www.example.org", canonical: { host: "apex", trailingSlash: true } })]);
    scope.config = test.config;
    scope.db = test.ctx.db;
  });

  it("declares an article's canonical and OG URL on seo's host with its trailing slash, and the feed without one", async () => {
    const metadata = await generateArticleMetadata(params("index-funds"));
    expect(metadata.alternates).toEqual({
      canonical: "https://example.org/blog/index-funds/",
      types: { "application/rss+xml": [{ url: "https://example.org/blog/rss.xml", title: "Blog | Example" }] },
    });
    expect(metadata.openGraph?.url).toBe("https://example.org/blog/index-funds/");
  });

  it("declares the listing's, the glossary's, a term's and the method page's canonical URLs by the same rule", async () => {
    expect((await generateBlogIndexMetadata()).alternates?.canonical).toBe("https://example.org/blog/");
    expect((await generateGlossaryIndexMetadata()).openGraph?.url).toBe("https://example.org/blog/glossary/");
    expect((await generateTermMetadata(params("expense-ratio"))).alternates).toEqual({ canonical: "https://example.org/blog/glossary/expense-ratio/" });
    expect(generateMethodMetadata().alternates).toEqual({ canonical: "https://example.org/blog/how-we-write/" });
  });

  it("puts the same canonical URL in the article's JSON-LD", async () => {
    const html = await render(BlogArticlePage(params("index-funds")));
    expect(html).toContain('"mainEntityOfPage":"https://example.org/blog/index-funds/"');
    expect(html).toContain('"image":"https://example.org/blog/index-funds/opengraph-image"');
    expect(html).not.toContain("app.example.com");
  });

  it("gives an app's own pages the same site origins: appOrigin and seo's canonical origin", () => {
    expect(getBodyOptions(test.config, []).origins).toEqual(["https://app.example.com", "https://example.org"]);
  });

  it("treats a body link to seo's canonical host as the site's own, like one to appOrigin", async () => {
    const body = "Read [taxes](https://example.org/blog/taxes), the [calculator](https://app.example.com/calculator) and [a fund](https://funds.example.net/).";
    const published = await runBlogPublish(test.ctx, [buildArticleFile({ id: "links", slug: "links", title: "Links", faq: [] }, body)], { commit: true });
    expect(published.status).toBe("done");
    const html = await render(BlogArticlePage(params("links")));
    expect(html).toContain('<a href="https://example.org/blog/taxes">taxes</a>');
    expect(html).toContain('<a href="https://app.example.com/calculator">calculator</a>');
    expect(html).toContain('<a href="https://funds.example.net/" rel="noopener noreferrer" target="_blank" class="blog-external">a fund');
  });
});

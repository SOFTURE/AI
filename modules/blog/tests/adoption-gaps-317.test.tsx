// Issue #317: an app with its own design system keeps the package's views and OG card. Class slots,
// `unstyled`, a layout component and card rendering on the views; an AI disclosure on the method page;
// a disclaimer that is a node; a logo and a muted label on the OG card; the body input on `/server`.
import { DEFAULT_THEME } from "@softure-ai/ui";
import * as next from "@softure-ai/blog/next";
import { createBlogArticleOgImage, getOgColors, renderArticleOgImage } from "@softure-ai/blog/next";
import { createOgFontLoader, findArticlesLinkingTermFor, getBodyOptions, getPageContext } from "@softure-ai/blog/server";
import {
  BlogArticleView,
  BlogListingView,
  BlogMethodView,
  GlossaryIndexView,
  type BlogLayoutSlotProps,
  type BlogPageContext,
} from "@softure-ai/blog/ui";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildStoredArticle, buildStoredTerm, createConfig } from "./support.js";

const BLOG_CLASS = /\bblog-[a-z-]+/g;

/** The `blog-*` classes in markup (ids such as `blog-sources` are not classes). */
function findBlogClasses(html: string): string[] {
  return [...html.matchAll(/class="([^"]*)"/g)].flatMap((match) => match[1]?.match(BLOG_CLASS) ?? []);
}

function createContext(overrides: Partial<BlogPageContext> = {}, options: Parameters<typeof createConfig>[0] = {}): BlogPageContext {
  return { ...getPageContext(createConfig({ methodPage: true, ...options })), ...overrides };
}

function renderListing(context: BlogPageContext, extra: Partial<Parameters<typeof BlogListingView>[0]> = {}): string {
  const lead = buildStoredArticle({ id: "pillar", slug: "pillar", title: "The pillar", isPillar: true });
  const article = buildStoredArticle();
  return renderToStaticMarkup(
    <BlogListingView context={context} groups={[{ cluster: "investing-basics", label: "Investing basics", lead, rest: [article] }]} termCount={1} timezone="Europe/Warsaw" {...extra} />,
  );
}

function renderArticle(context: BlogPageContext): string {
  const article = buildStoredArticle();
  return renderToStaticMarkup(
    <BlogArticleView
      context={context}
      article={article}
      dates={{ published: "2026-09-15", updated: null, currentAsOf: "2026-10-01" }}
      body={{ segments: [{ kind: "html", html: "<p>Body.</p>" }], headings: [], readingMinutes: 1 }}
      crumbs={[
        { name: "Blog", path: "/blog" },
        { name: article.title, path: "/blog/index-funds" },
      ]}
      jsonLd="{}"
    />,
  );
}

describe("views: class slots (#317)", () => {
  it("renders the same markup as before without slots", () => {
    const html = renderListing(createContext());
    expect(html).toContain('<main class="blog-page"><header class="blog-header"><h1 class="blog-title">');
    expect(html).toContain('<article class="blog-card blog-card-lead" data-slug="pillar">');
  });

  it("adds the app's class after the package's on each named element", () => {
    const html = renderListing(createContext({ classNames: { page: "app-page", title: "app-h1", card: "app-card", cardLead: "app-card-lead" } }));
    expect(html).toContain('<main class="blog-page app-page">');
    expect(html).toContain('<h1 class="blog-title app-h1">');
    expect(html).toContain('<article class="blog-card app-card blog-card-lead app-card-lead" data-slug="pillar">');
    expect(html).toContain('<article class="blog-card app-card" data-slug="index-funds">');
  });

  it("writes only the app's classes when unstyled, except the visually hidden one it does not map", () => {
    const html = renderArticle(createContext({ unstyled: true, classNames: { page: "app-page" } }));
    expect(html).toContain('<main class="app-page">');
    expect(new Set(findBlogClasses(html))).toEqual(new Set(["blog-visually-hidden"]));
    const mapped = renderArticle(createContext({ unstyled: true, classNames: { visuallyHidden: "sr-only" } }));
    expect(findBlogClasses(mapped)).toEqual([]);
    expect(mapped).toContain('<li class="sr-only" aria-current="page">');
  });
});

describe("views: layout and cards (#317)", () => {
  it("hands the header parts and the content to the app's layout instead of the package's frame", () => {
    const seen: Omit<BlogLayoutSlotProps, "children" | "context">[] = [];
    function AppFrame({ title, lead, crumbs, meta, children }: BlogLayoutSlotProps) {
      seen.push({ title, lead, crumbs, meta });
      return (
        <div className="app-frame">
          <h1>{title}</h1>
          {meta}
          {children}
        </div>
      );
    }
    const html = renderArticle(createContext({ layout: AppFrame }));
    expect(html.startsWith('<div class="app-frame"><h1>Index funds in plain words</h1><dl class="blog-dates">')).toBe(true);
    expect(html).not.toContain("blog-page");
    expect(seen).toHaveLength(1);
    expect(seen[0]?.lead).toBe("What an index fund is and what it costs.");
    expect(seen[0]?.crumbs?.map((crumb) => crumb.path)).toEqual(["/blog", "/blog/index-funds"]);
  });

  it("renders each listing card with the app's renderCard", () => {
    const html = renderListing(createContext(), {
      renderCard: ({ article, href, isLead }) => (
        <a className="app-card" href={href} data-lead={String(isLead)}>
          {article.title}
        </a>
      ),
    });
    expect(html).toContain('<a class="app-card" href="/blog/pillar" data-lead="true">The pillar</a>');
    expect(html).toContain('<li><a class="app-card" href="/blog/index-funds" data-lead="false">Index funds in plain words</a></li>');
    expect(html).not.toMatch(/class="blog-card[ "]/);
  });
});

describe("views: disclaimer and AI disclosure (#317)", () => {
  it("renders a disclaimer node with its links, and a string in a paragraph as before", () => {
    const node = (
      <p>
        Not advice. <a href="/terms">Terms</a>
      </p>
    );
    const html = renderToStaticMarkup(<GlossaryIndexView context={createContext({ disclaimer: node })} terms={[buildStoredTerm()]} jsonLd={null} />);
    expect(html).toContain('<aside aria-label="Disclaimer" class="blog-disclaimer"><p>Not advice. <a href="/terms">Terms</a></p></aside>');
    const plain = renderToStaticMarkup(<GlossaryIndexView context={createContext({}, { disclaimer: { en: "Not advice." } })} terms={[]} jsonLd={null} />);
    expect(plain).toContain('<aside aria-label="Disclaimer" class="blog-disclaimer"><p>Not advice.</p></aside>');
  });

  it("shows no AI section by default", () => {
    const html = renderToStaticMarkup(<BlogMethodView context={createContext()} />);
    expect(html).not.toContain('id="ai"');
    expect(html).toContain(createContext().messages.method.whoBody.replaceAll("'", "&#x27;"));
  });

  it("opens the method page with the AI disclosure and drops the human-editor claim with aiDisclosure", () => {
    const context = createContext({}, { aiDisclosure: true });
    expect(context.aiDisclosure).toBe(true);
    const copy = context.messages.method;
    const html = renderToStaticMarkup(<BlogMethodView context={context} />);
    expect(html).toContain(`<section id="ai" aria-labelledby="ai-heading" class="blog-section"><h2 id="ai-heading">${copy.aiTitle}</h2><p>${copy.aiBody}</p></section>`);
    expect(html.indexOf('id="ai"')).toBeLessThan(html.indexOf('id="who"'));
    expect(html).toContain(copy.whoBodyAi);
    expect(html).not.toContain(copy.whoBody);
  });

  it("has the disclosure copy in English and translated Polish", () => {
    const en = createContext().messages.method;
    const pl = getPageContext({ ...createConfig(), locale: "pl" }).messages.method;
    for (const key of ["aiTitle", "aiBody", "whoBodyAi"] as const) {
      expect(en[key].length).toBeGreaterThan(0);
      expect(pl[key]).not.toBe(en[key]);
    }
  });
});

describe("OG card: logo and muted label (#317)", () => {
  it("draws the label in the brand's muted colour, else in the foreground as before", () => {
    expect(getOgColors(undefined).muted).toBe(DEFAULT_THEME.dark["color-foreground"]);
    expect(getOgColors({ name: "Example", colors: { muted: "#777777" } }).muted).toBe("#777777");
  });

  it("draws the app's logo in the top row", async () => {
    const base = { title: "Index funds", label: "Blog", brand: { name: "Example" } };
    const logo = <div style={{ display: "flex", width: 40, height: 40, background: "#ff0000" }} />;
    const [plain, withLogo] = await Promise.all([renderArticleOgImage(base).arrayBuffer(), renderArticleOgImage({ ...base, logo }).arrayBuffer()]);
    expect(Buffer.from(withLogo).equals(Buffer.from(plain))).toBe(false);
  });

  it("builds the card's route with the app's logo and label", () => {
    expect(typeof createBlogArticleOgImage({ label: "Our blog" })).toBe("function");
    expect(typeof next.BlogArticleOgImage).toBe("function");
  });
});

describe("/server: the body input and the OG font loader (#317)", () => {
  it("exports the same body helpers and font loader as /next", () => {
    expect(getBodyOptions).toBe(next.getBodyOptions);
    expect(findArticlesLinkingTermFor).toBe(next.findArticlesLinkingTermFor);
    expect(getPageContext).toBe(next.getPageContext);
    expect(createOgFontLoader).toBe(next.createOgFontLoader);
  });

  it("builds the pages' body input outside Next", () => {
    const config = createConfig();
    const options = getBodyOptions(config, [buildStoredTerm()]);
    expect(options.routes).toEqual(getPageContext(config).routes);
    expect(options.glossary.map((term) => term.slug)).toEqual(["expense-ratio"]);
  });
});

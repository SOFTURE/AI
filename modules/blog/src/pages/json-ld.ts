// Structured data of the blog's pages (schema.org as JSON-LD), built from stored rows. Every URL is
// absolute on the site's origin (a page's is its canonical URL, core's `getSiteUrls`); every date is a
// day the page shows.
import type { Locale, SiteUrls } from "@softure-ai/core";
import type { BlogArticle } from "../contract.js";
import { getArticleDates } from "./dates.js";
import type { Crumb } from "./listing.js";
import { getArticlePath, getTermPath, type BlogRoutes } from "./paths.js";

export interface JsonLdContext {
  /** The site's origin and canonical rule (`getSiteUrls(config)`: seo's when the app lists it, else `appOrigin`). */
  readonly urls: SiteUrls;
  readonly routes: BlogRoutes;
  readonly locale: Locale;
  /** The BCP-47 tag written as `inLanguage` (`getBlogLocaleTags`); `locale` when left out. */
  readonly language?: string;
  /** The `@id` fragments; `article`, `term` and `glossary` when left out. */
  readonly ids?: JsonLdIds;
  readonly timezone: string;
  /** The brand as author and publisher; `null` leaves them out. */
  readonly brand: string | null;
}

/** The fragments after `#` in the nodes' `@id`s. */
export interface JsonLdIds {
  readonly article: string;
  readonly term: string;
  readonly glossary: string;
}

export const DEFAULT_JSON_LD_IDS: JsonLdIds = { article: "article", term: "term", glossary: "glossary" };

type JsonLd = Record<string, unknown>;

function getIds(ctx: Pick<JsonLdContext, "ids">): JsonLdIds {
  return ctx.ids ?? DEFAULT_JSON_LD_IDS;
}

function getLanguage(ctx: Pick<JsonLdContext, "language" | "locale">): string {
  return ctx.language ?? ctx.locale;
}

/** JSON for a `<script type="application/ld+json">`: no text in it can close the tag. */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

/** A crumb's URL: its page's canonical URL, then its fragment (a cluster's anchor on the listing), which the canonical rule drops. */
function getCrumbUrl(path: string, urls: SiteUrls): string {
  const hashAt = path.indexOf("#");
  return hashAt === -1 ? urls.getCanonicalUrl(path) : `${urls.getCanonicalUrl(path.slice(0, hashAt))}${path.slice(hashAt)}`;
}

function getBreadcrumbs(crumbs: readonly Crumb[], urls: SiteUrls): JsonLd {
  return {
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({ "@type": "ListItem", position: index + 1, name: crumb.name, item: getCrumbUrl(crumb.path, urls) })),
  };
}

/**
 * The URL of an article's OG image (Next serves `opengraph-image` under the page's path). A file, not a
 * page: on the site's origin without the canonical trailing-slash rule.
 */
export function getArticleImageUrl(article: Pick<BlogArticle, "slug">, ctx: Pick<JsonLdContext, "urls" | "routes">): string {
  return `${ctx.urls.origin}${getArticlePath(ctx.routes, article.slug)}/opengraph-image`;
}

/**
 * An article: `BlogPosting` (an `Article` type), its `BreadcrumbList`, and `FAQPage` when it has
 * questions, in one `@graph`. `dateModified` equals the visible update day, or the publication day
 * when the content never changed: a mismatch reads as a faked freshness.
 */
export function getArticleJsonLd(article: BlogArticle, crumbs: readonly Crumb[], ctx: JsonLdContext): JsonLd {
  const dates = getArticleDates(article, ctx.timezone);
  const url = ctx.urls.getCanonicalUrl(getArticlePath(ctx.routes, article.slug));
  const brand = ctx.brand === null ? null : { "@type": "Organization", name: ctx.brand, url: ctx.urls.getCanonicalUrl("/") };
  const graph: JsonLd[] = [
    {
      "@type": "BlogPosting",
      "@id": `${url}#${getIds(ctx).article}`,
      mainEntityOfPage: url,
      url,
      headline: article.title,
      description: article.description,
      inLanguage: getLanguage(ctx),
      datePublished: dates.published,
      dateModified: dates.updated ?? dates.published,
      ...(brand === null ? {} : { author: brand, publisher: brand }),
      image: getArticleImageUrl(article, ctx),
      ...(article.sources.length > 0 ? { citation: article.sources.map((source) => ({ "@type": "CreativeWork", name: source.name, url: source.url })) } : {}),
    },
    getBreadcrumbs(crumbs, ctx.urls),
  ];
  if (article.faq.length > 0) {
    graph.push({
      "@type": "FAQPage",
      mainEntity: article.faq.map((entry) => ({ "@type": "Question", name: entry.question, acceptedAnswer: { "@type": "Answer", text: entry.answer } })),
    });
  }
  return { "@context": "https://schema.org", "@graph": graph };
}

function getTermSetReference(ctx: Pick<JsonLdContext, "urls" | "routes" | "ids">, glossaryTitle: string): JsonLd {
  return { "@type": "DefinedTermSet", "@id": `${ctx.urls.getCanonicalUrl(ctx.routes.glossary)}#${getIds(ctx).glossary}`, name: glossaryTitle };
}

/** A term: `DefinedTerm` in the glossary's `DefinedTermSet`, and its `BreadcrumbList`. */
export function getTermJsonLd(term: BlogArticle, crumbs: readonly Crumb[], ctx: JsonLdContext, glossaryTitle: string): JsonLd {
  const url = ctx.urls.getCanonicalUrl(getTermPath(ctx.routes, term.slug));
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "DefinedTerm",
        "@id": `${url}#${getIds(ctx).term}`,
        url,
        name: term.title,
        description: term.description,
        inLanguage: getLanguage(ctx),
        ...(term.termForms.length > 0 ? { alternateName: term.termForms } : {}),
        inDefinedTermSet: getTermSetReference(ctx, glossaryTitle),
      },
      getBreadcrumbs(crumbs, ctx.urls),
    ],
  };
}

/** The glossary index: one `DefinedTermSet` with every term, in the order given. */
export function getGlossaryJsonLd(terms: readonly BlogArticle[], ctx: JsonLdContext, glossaryTitle: string): JsonLd {
  return {
    "@context": "https://schema.org",
    ...getTermSetReference(ctx, glossaryTitle),
    url: ctx.urls.getCanonicalUrl(ctx.routes.glossary),
    inLanguage: getLanguage(ctx),
    hasDefinedTerm: terms.map((term) => {
      const url = ctx.urls.getCanonicalUrl(getTermPath(ctx.routes, term.slug));
      return { "@type": "DefinedTerm", "@id": `${url}#${getIds(ctx).term}`, name: term.title, description: term.description, url };
    }),
  };
}

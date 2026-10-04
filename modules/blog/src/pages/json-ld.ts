// Structured data of the blog's pages (schema.org as JSON-LD), built from stored rows. Every URL is
// absolute on the app's origin; every date is a day the page shows.
import type { Locale } from "@softure-ai/core";
import type { BlogArticle } from "../contract.js";
import { getArticleDates } from "./dates.js";
import type { Crumb } from "./listing.js";
import { getArticlePath, getTermPath, type BlogRoutes } from "./paths.js";

export interface JsonLdContext {
  /** The app's origin, e.g. `https://example.com`. */
  readonly origin: string;
  readonly routes: BlogRoutes;
  readonly locale: Locale;
  readonly timezone: string;
  /** The brand as author and publisher; `null` leaves them out. */
  readonly brand: string | null;
}

type JsonLd = Record<string, unknown>;

/** JSON for a `<script type="application/ld+json">`: no text in it can close the tag. */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

function getBreadcrumbs(crumbs: readonly Crumb[], origin: string): JsonLd {
  return {
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({ "@type": "ListItem", position: index + 1, name: crumb.name, item: `${origin}${crumb.path}` })),
  };
}

/** The URL of an article's OG image (Next serves `opengraph-image` under the page's path). */
export function getArticleImageUrl(article: Pick<BlogArticle, "slug">, ctx: Pick<JsonLdContext, "origin" | "routes">): string {
  return `${ctx.origin}${getArticlePath(ctx.routes, article.slug)}/opengraph-image`;
}

/**
 * An article: `BlogPosting` (an `Article` type), its `BreadcrumbList`, and `FAQPage` when it has
 * questions, in one `@graph`. `dateModified` equals the visible update day, or the publication day
 * when the content never changed: a mismatch reads as a faked freshness.
 */
export function getArticleJsonLd(article: BlogArticle, crumbs: readonly Crumb[], ctx: JsonLdContext): JsonLd {
  const dates = getArticleDates(article, ctx.timezone);
  const url = `${ctx.origin}${getArticlePath(ctx.routes, article.slug)}`;
  const brand = ctx.brand === null ? null : { "@type": "Organization", name: ctx.brand, url: `${ctx.origin}/` };
  const graph: JsonLd[] = [
    {
      "@type": "BlogPosting",
      "@id": `${url}#article`,
      mainEntityOfPage: url,
      url,
      headline: article.title,
      description: article.description,
      inLanguage: ctx.locale,
      datePublished: dates.published,
      dateModified: dates.updated ?? dates.published,
      ...(brand === null ? {} : { author: brand, publisher: brand }),
      image: getArticleImageUrl(article, ctx),
      ...(article.sources.length > 0 ? { citation: article.sources.map((source) => ({ "@type": "CreativeWork", name: source.name, url: source.url })) } : {}),
    },
    getBreadcrumbs(crumbs, ctx.origin),
  ];
  if (article.faq.length > 0) {
    graph.push({
      "@type": "FAQPage",
      mainEntity: article.faq.map((entry) => ({ "@type": "Question", name: entry.question, acceptedAnswer: { "@type": "Answer", text: entry.answer } })),
    });
  }
  return { "@context": "https://schema.org", "@graph": graph };
}

function getTermSetReference(ctx: Pick<JsonLdContext, "origin" | "routes">, glossaryTitle: string): JsonLd {
  return { "@type": "DefinedTermSet", "@id": `${ctx.origin}${ctx.routes.glossary}#glossary`, name: glossaryTitle };
}

/** A term: `DefinedTerm` in the glossary's `DefinedTermSet`, and its `BreadcrumbList`. */
export function getTermJsonLd(term: BlogArticle, crumbs: readonly Crumb[], ctx: JsonLdContext, glossaryTitle: string): JsonLd {
  const url = `${ctx.origin}${getTermPath(ctx.routes, term.slug)}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "DefinedTerm",
        "@id": `${url}#term`,
        url,
        name: term.title,
        description: term.description,
        inLanguage: ctx.locale,
        ...(term.termForms.length > 0 ? { alternateName: term.termForms } : {}),
        inDefinedTermSet: getTermSetReference(ctx, glossaryTitle),
      },
      getBreadcrumbs(crumbs, ctx.origin),
    ],
  };
}

/** The glossary index: one `DefinedTermSet` with every term, in the order given. */
export function getGlossaryJsonLd(terms: readonly BlogArticle[], ctx: JsonLdContext, glossaryTitle: string): JsonLd {
  return {
    "@context": "https://schema.org",
    ...getTermSetReference(ctx, glossaryTitle),
    url: `${ctx.origin}${ctx.routes.glossary}`,
    inLanguage: ctx.locale,
    hasDefinedTerm: terms.map((term) => {
      const url = `${ctx.origin}${getTermPath(ctx.routes, term.slug)}`;
      return { "@type": "DefinedTerm", "@id": `${url}#term`, name: term.title, description: term.description, url };
    }),
  };
}

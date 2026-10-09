// The metadata of the blog's pages (`<title>`, description, robots, canonical, feed link, Open Graph),
// built from what the caller already holds: no database read, no request scope. The ready-made pages'
// `generate*Metadata` read the text and call these; an app with its own page components calls them
// with the text it read, and can extend the result:
//
//   export async function generateMetadata({ params }) {
//     const config = getSoftureConfig();
//     const article = await getTextBySlug(config, (await params).slug);
//     if (article?.status !== "published" || article.kind !== "article") return {};
//     return { ...buildArticleMetadata(config, article), keywords: [...] };
//   }
import { formatMessage, getSiteUrls, type SoftureConfig } from "@softure-ai/core";
// `next/types.js`, not `next`: the root entry adds Next's globals (a read-only NODE_ENV) to every
// program that includes this file.
import type { Metadata } from "next/types.js";
import type { BlogArticle } from "../contract.js";
import { getArticleDates } from "../pages/dates.js";
import { getArticlePath, getTermPath } from "../pages/paths.js";
import { getBlogLocaleTags } from "../server/options.js";
import type { BlogPageContext } from "../ui/page-context.js";
import { getPageContext } from "./context.js";

/** The Open Graph images a page names: a URL, an image descriptor, or a list of them (Next's shape). */
export type BlogOpenGraphImages = NonNullable<NonNullable<Metadata["openGraph"]>["images"]>;

/**
 * What the app adds to a static page's metadata (listing, glossary index, method page). Next replaces
 * the layout's `openGraph` with the page's object, so a page that sets one loses the layout's card:
 * `images` carries it over, e.g. `[{ url: "/opengraph-image", width: 1200, height: 630 }]`.
 */
export interface StaticMetadataInput {
  readonly images?: BlogOpenGraphImages;
}

/** Whether a listing has no entry: an empty listing stays out of the index (thin content). */
export interface ListingMetadataInput extends StaticMetadataInput {
  readonly isEmpty: boolean;
}

/** `pattern`: the page kind's title message (`pages.titleWithBrand`, or `glossary.termTitleWithBrand` for a term). */
function withBrand(title: string, context: BlogPageContext, pattern: string = context.messages.pages.titleWithBrand): string {
  return context.brand === null ? title : formatMessage(pattern, { title, brand: context.brand });
}

/** A page's canonical URL: seo's host and trailing-slash rule when the app lists seo, else on `appOrigin`. */
function getCanonicalUrl(config: SoftureConfig, path: string): string {
  return getSiteUrls(config).getCanonicalUrl(path);
}

/** The feed link a reader finds in `<head>` (`<link rel="alternate" type="application/rss+xml">`); a file, so no trailing-slash rule. */
function getFeedAlternates(config: SoftureConfig, context: BlogPageContext): NonNullable<Metadata["alternates"]>["types"] {
  return { "application/rss+xml": [{ url: `${getSiteUrls(config).origin}${context.routes.rss}`, title: withBrand(context.messages.pages.blogTitle, context) }] };
}

function getStaticMetadata(
  config: SoftureConfig,
  context: BlogPageContext,
  page: { title: string; description: string; path: string; isEmpty?: boolean; hasFeed?: boolean; images?: BlogOpenGraphImages | undefined },
): Metadata {
  return {
    title: withBrand(page.title, context),
    description: page.description,
    robots: { index: page.isEmpty !== true, follow: true },
    alternates: { canonical: getCanonicalUrl(config, page.path), ...(page.hasFeed === true ? { types: getFeedAlternates(config, context) } : {}) },
    openGraph: {
      type: "website",
      title: page.title,
      description: page.description,
      url: getCanonicalUrl(config, page.path),
      locale: getBlogLocaleTags(config).openGraph,
      ...(context.brand === null ? {} : { siteName: context.brand }),
      ...(page.images === undefined ? {} : { images: page.images }),
    },
  };
}

function getTextMetadata(config: SoftureConfig, context: BlogPageContext, text: BlogArticle, path: string, options: { hasFeed?: boolean; titlePattern?: string } = {}): Metadata {
  const dates = getArticleDates(text, config.timezone);
  const url = getCanonicalUrl(config, path);
  return {
    title: withBrand(text.title, context, options.titlePattern),
    description: text.description,
    robots: { index: true, follow: true },
    alternates: { canonical: url, ...(options.hasFeed === true ? { types: getFeedAlternates(config, context) } : {}) },
    openGraph: {
      type: "article",
      title: text.title,
      description: text.description,
      url,
      locale: getBlogLocaleTags(config).openGraph,
      publishedTime: dates.published,
      modifiedTime: dates.updated ?? dates.published,
      ...(context.brand === null ? {} : { siteName: context.brand }),
    },
  };
}

/** The listing's metadata, with the feed link; `images` carries the app's Open Graph card. */
export function buildBlogIndexMetadata(config: SoftureConfig, { isEmpty, images }: ListingMetadataInput): Metadata {
  const context = getPageContext(config);
  const copy = context.messages.pages;
  return getStaticMetadata(config, context, { title: copy.blogTitle, description: copy.blogDescription, path: context.routes.index, isEmpty, hasFeed: true, images });
}

/** An article's metadata, with the feed link. The caller checks the text is a published article. */
export function buildArticleMetadata(config: SoftureConfig, article: BlogArticle): Metadata {
  const context = getPageContext(config);
  return getTextMetadata(config, context, article, getArticlePath(context.routes, article.slug), { hasFeed: true });
}

/** The glossary index's metadata; `images` carries the app's Open Graph card. */
export function buildGlossaryIndexMetadata(config: SoftureConfig, { isEmpty, images }: ListingMetadataInput): Metadata {
  const context = getPageContext(config);
  const copy = context.messages.glossary;
  return getStaticMetadata(config, context, { title: copy.title, description: copy.description, path: context.routes.glossary, isEmpty, images });
}

/** A glossary term's metadata, titled by `glossary.termTitleWithBrand`. The caller checks the text is a published term. */
export function buildTermMetadata(config: SoftureConfig, term: BlogArticle): Metadata {
  const context = getPageContext(config);
  return getTextMetadata(config, context, term, getTermPath(context.routes, term.slug), { titlePattern: context.messages.glossary.termTitleWithBrand });
}

/** The method page's metadata; `images` carries the app's Open Graph card. */
export function buildMethodMetadata(config: SoftureConfig, { images }: StaticMetadataInput = {}): Metadata {
  const context = getPageContext(config);
  const copy = context.messages.method;
  return getStaticMetadata(config, context, { title: copy.title, description: copy.description, path: context.routes.method, images });
}

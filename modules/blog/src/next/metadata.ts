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
import type { BlogPageContext } from "../ui/page-context.js";
import { getPageContext } from "./context.js";

/** Whether a listing has no entry: an empty listing stays out of the index (thin content). */
export interface ListingMetadataInput {
  readonly isEmpty: boolean;
}

function withBrand(title: string, context: BlogPageContext): string {
  return context.brand === null ? title : formatMessage(context.messages.pages.titleWithBrand, { title, brand: context.brand });
}

/** A page's canonical URL: seo's host and trailing-slash rule when the app lists seo, else on `appOrigin`. */
function getCanonicalUrl(config: SoftureConfig, path: string): string {
  return getSiteUrls(config).getCanonicalUrl(path);
}

/** The feed link a reader finds in `<head>` (`<link rel="alternate" type="application/rss+xml">`); a file, so no trailing-slash rule. */
function getFeedAlternates(config: SoftureConfig, context: BlogPageContext): NonNullable<Metadata["alternates"]>["types"] {
  return { "application/rss+xml": [{ url: `${getSiteUrls(config).origin}${context.routes.rss}`, title: withBrand(context.messages.pages.blogTitle, context) }] };
}

function getStaticMetadata(config: SoftureConfig, context: BlogPageContext, page: { title: string; description: string; path: string; isEmpty?: boolean; hasFeed?: boolean }): Metadata {
  return {
    title: withBrand(page.title, context),
    description: page.description,
    robots: { index: page.isEmpty !== true, follow: true },
    alternates: { canonical: getCanonicalUrl(config, page.path), ...(page.hasFeed === true ? { types: getFeedAlternates(config, context) } : {}) },
    openGraph: { type: "website", title: page.title, description: page.description, url: getCanonicalUrl(config, page.path), ...(context.brand === null ? {} : { siteName: context.brand }) },
  };
}

function getTextMetadata(config: SoftureConfig, context: BlogPageContext, text: BlogArticle, path: string, options: { hasFeed?: boolean } = {}): Metadata {
  const dates = getArticleDates(text, config.timezone);
  const url = getCanonicalUrl(config, path);
  return {
    title: withBrand(text.title, context),
    description: text.description,
    robots: { index: true, follow: true },
    alternates: { canonical: url, ...(options.hasFeed === true ? { types: getFeedAlternates(config, context) } : {}) },
    openGraph: {
      type: "article",
      title: text.title,
      description: text.description,
      url,
      locale: config.locale,
      publishedTime: dates.published,
      modifiedTime: dates.updated ?? dates.published,
      ...(context.brand === null ? {} : { siteName: context.brand }),
    },
  };
}

/** The listing's metadata, with the feed link. */
export function buildBlogIndexMetadata(config: SoftureConfig, { isEmpty }: ListingMetadataInput): Metadata {
  const context = getPageContext(config);
  const copy = context.messages.pages;
  return getStaticMetadata(config, context, { title: copy.blogTitle, description: copy.blogDescription, path: context.routes.index, isEmpty, hasFeed: true });
}

/** An article's metadata, with the feed link. The caller checks the text is a published article. */
export function buildArticleMetadata(config: SoftureConfig, article: BlogArticle): Metadata {
  const context = getPageContext(config);
  return getTextMetadata(config, context, article, getArticlePath(context.routes, article.slug), { hasFeed: true });
}

/** The glossary index's metadata. */
export function buildGlossaryIndexMetadata(config: SoftureConfig, { isEmpty }: ListingMetadataInput): Metadata {
  const context = getPageContext(config);
  const copy = context.messages.glossary;
  return getStaticMetadata(config, context, { title: copy.title, description: copy.description, path: context.routes.glossary, isEmpty });
}

/** A glossary term's metadata. The caller checks the text is a published term. */
export function buildTermMetadata(config: SoftureConfig, term: BlogArticle): Metadata {
  const context = getPageContext(config);
  return getTextMetadata(config, context, term, getTermPath(context.routes, term.slug));
}

/** The method page's metadata. */
export function buildMethodMetadata(config: SoftureConfig): Metadata {
  const context = getPageContext(config);
  const copy = context.messages.method;
  return getStaticMetadata(config, context, { title: copy.title, description: copy.description, path: context.routes.method });
}

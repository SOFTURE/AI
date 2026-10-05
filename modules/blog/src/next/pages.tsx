// The blog's pages, ready to mount with one line each (docs/02-module-standard.md §8):
//
//   app/blog/page.tsx                  export { BlogIndexPage as default, generateBlogIndexMetadata as generateMetadata } from "@softure-ai/blog/next";
//                                      export const dynamic = "force-dynamic";
//   app/blog/[slug]/page.tsx           export { BlogArticlePage as default, generateArticleMetadata as generateMetadata, generateBlogStaticParams as generateStaticParams } from "@softure-ai/blog/next";
//                                      export const revalidate = 300;
//   app/blog/glossary/page.tsx         GlossaryIndexPage, generateGlossaryIndexMetadata; dynamic
//   app/blog/glossary/[slug]/page.tsx  GlossaryTermPage, generateTermMetadata, generateBlogStaticParams; revalidate
//   app/blog/how-we-write/page.tsx     BlogMethodPage, generateMethodMetadata (with `blog({ methodPage: true })`)
//   app/blog/rss.xml/route.ts          serveBlogRss as GET; dynamic (see discovery.ts)
//
// Next reads `dynamic` and `revalidate` statically, so they stay literals in the app's files: the
// listing and the glossary index render per request (a build has no database) over cached reads;
// articles and terms render on their first request and are kept for `revalidate` seconds (ISR).
// 301 and 410 are answered before the page by `@softure-ai/blog/proxy`; anything else that is not a
// published text of the page's kind is a 404 here.
import { formatMessage, getSiteUrls, type SoftureConfig } from "@softure-ai/core";
import { getSoftureConfig } from "@softure-ai/core/next";
// `next/types.js`, not `next`: the root entry adds Next's globals (a read-only NODE_ENV) to every
// program that includes this file.
import type { Metadata } from "next/types.js";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import type { BlogArticle } from "../contract.js";
import { getRelatedArticles } from "../discovery/related.js";
import { findArticlesLinkingTerm, renderPageBody, type RenderPageBodyOptions } from "../pages/body.js";
import { getArticleDates } from "../pages/dates.js";
import { getArticleJsonLd, getGlossaryJsonLd, getTermJsonLd, serializeJsonLd, type JsonLdContext } from "../pages/json-ld.js";
import { getArticleCrumbs, getClusterLabel, getTermCrumbs, groupByCluster, sortTerms, type CrumbLabels } from "../pages/listing.js";
import { getArticlePath, getTermPath } from "../pages/paths.js";
import { toGlossary } from "../render/glossary.js";
import { getBlogOptions } from "../server/options.js";
import { BlogArticleView } from "../ui/blog-article.js";
import { GlossaryIndexView, GlossaryTermView } from "../ui/blog-glossary.js";
import { BlogListingView } from "../ui/blog-listing.js";
import { BlogMethodView } from "../ui/blog-method.js";
import type { BlogPageContext } from "../ui/page-context.js";
import { getPageContext } from "./context.js";
import { getPublishedArticles, getPublishedTerms, getTextBySlug } from "./data.js";

type SlugParams = Promise<{ readonly slug: string }>;

export interface BlogIndexPageProps {
  /** The app's call to action under the cards. */
  readonly cta?: ReactNode;
}

export interface BlogArticlePageProps {
  readonly params: SlugParams;
  /** The app's call to action right after the text. */
  readonly cta?: ReactNode;
  /** The app's block under the article, e.g. `<Waitlist placement="blog" />`. */
  readonly afterArticle?: ReactNode;
}

export interface GlossaryTermPageProps {
  readonly params: SlugParams;
  readonly cta?: ReactNode;
}

/** No page is built ahead: the build has no database. The first request renders a slug. */
export function generateBlogStaticParams(): { slug: string }[] {
  return [];
}

function isPublished(text: BlogArticle | null, kind: BlogArticle["kind"]): text is BlogArticle {
  return text !== null && text.status === "published" && text.kind === kind;
}

function getCrumbLabels(config: SoftureConfig, context: BlogPageContext): CrumbLabels {
  const clusters = getBlogOptions(config).clusters;
  return {
    blog: context.messages.pages.blogTitle,
    glossary: context.messages.glossary.title,
    cluster: (cluster) => getClusterLabel(cluster, clusters, config.locale),
  };
}

function getJsonLdContext(config: SoftureConfig, context: BlogPageContext): JsonLdContext {
  return { urls: getSiteUrls(config), routes: context.routes, locale: config.locale, timezone: config.timezone, brand: context.brand };
}

function getBodyOptions(config: SoftureConfig, context: BlogPageContext, terms: readonly BlogArticle[]): RenderPageBodyOptions {
  return { glossary: toGlossary(terms), routes: context.routes, options: getBlogOptions(config), origin: config.appOrigin, messages: context.messages };
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

/** Metadata of a page with a fixed path; an empty listing stays out of the index (thin content). */
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

export async function generateBlogIndexMetadata(): Promise<Metadata> {
  const config = getSoftureConfig();
  const context = getPageContext(config);
  const articles = await getPublishedArticles(config);
  const copy = context.messages.pages;
  return getStaticMetadata(config, context, { title: copy.blogTitle, description: copy.blogDescription, path: context.routes.index, isEmpty: articles.length === 0, hasFeed: true });
}

/** The listing: cards grouped by cluster, the pillar first. Mount with `dynamic = "force-dynamic"`. */
export async function BlogIndexPage({ cta }: BlogIndexPageProps = {}) {
  const config = getSoftureConfig();
  const context = getPageContext(config);
  const labels = getCrumbLabels(config, context);
  const [articles, terms] = await Promise.all([getPublishedArticles(config), getPublishedTerms(config)]);
  const groups = groupByCluster(articles, labels.cluster, context.messages.pages.otherCluster);
  return <BlogListingView context={context} groups={groups} termCount={terms.length} timezone={config.timezone} cta={cta} />;
}

export async function generateArticleMetadata({ params }: { readonly params: SlugParams }): Promise<Metadata> {
  const config = getSoftureConfig();
  const { slug } = await params;
  const article = await getTextBySlug(config, slug);
  if (!isPublished(article, "article")) return {};
  const context = getPageContext(config);
  return getTextMetadata(config, context, article, getArticlePath(context.routes, article.slug), { hasFeed: true });
}

/** An article with "read next" under it. Mount with `revalidate` and `generateBlogStaticParams`. */
export async function BlogArticlePage({ params, cta, afterArticle }: BlogArticlePageProps) {
  const config = getSoftureConfig();
  const { slug } = await params;
  const article = await getTextBySlug(config, slug);
  if (!isPublished(article, "article")) notFound();
  const context = getPageContext(config);
  const [terms, published] = await Promise.all([getPublishedTerms(config), getPublishedArticles(config)]);
  const body = renderPageBody<ReactNode>(article, getBodyOptions(config, context, terms));
  const crumbs = getArticleCrumbs(article, context.routes, getCrumbLabels(config, context));
  const jsonLd = serializeJsonLd(getArticleJsonLd(article, crumbs, getJsonLdContext(config, context)));
  return (
    <BlogArticleView
      context={context}
      article={article}
      dates={getArticleDates(article, config.timezone)}
      body={body}
      crumbs={crumbs}
      jsonLd={jsonLd}
      cta={cta}
      afterArticle={afterArticle}
      related={getRelatedArticles(article, published)}
    />
  );
}

export async function generateGlossaryIndexMetadata(): Promise<Metadata> {
  const config = getSoftureConfig();
  const context = getPageContext(config);
  const terms = await getPublishedTerms(config);
  const copy = context.messages.glossary;
  return getStaticMetadata(config, context, { title: copy.title, description: copy.description, path: context.routes.glossary, isEmpty: terms.length === 0 });
}

/** The glossary index. Mount with `dynamic = "force-dynamic"`. */
export async function GlossaryIndexPage() {
  const config = getSoftureConfig();
  const context = getPageContext(config);
  const terms = sortTerms(await getPublishedTerms(config), config.locale);
  const jsonLd = terms.length === 0 ? null : serializeJsonLd(getGlossaryJsonLd(terms, getJsonLdContext(config, context), context.messages.glossary.title));
  return <GlossaryIndexView context={context} terms={terms} jsonLd={jsonLd} />;
}

export async function generateTermMetadata({ params }: { readonly params: SlugParams }): Promise<Metadata> {
  const config = getSoftureConfig();
  const { slug } = await params;
  const term = await getTextBySlug(config, slug);
  if (!isPublished(term, "term")) return {};
  const context = getPageContext(config);
  return getTextMetadata(config, context, term, getTermPath(context.routes, term.slug));
}

/** A glossary term with the articles that expand on it. Mount with `revalidate` and `generateBlogStaticParams`. */
export async function GlossaryTermPage({ params, cta }: GlossaryTermPageProps) {
  const config = getSoftureConfig();
  const { slug } = await params;
  const term = await getTextBySlug(config, slug);
  if (!isPublished(term, "term")) notFound();
  const context = getPageContext(config);
  const [terms, articles] = await Promise.all([getPublishedTerms(config), getPublishedArticles(config)]);
  const bodyOptions = getBodyOptions(config, context, terms);
  const crumbs = getTermCrumbs(term, context.routes, getCrumbLabels(config, context));
  const jsonLd = serializeJsonLd(getTermJsonLd(term, crumbs, getJsonLdContext(config, context), context.messages.glossary.title));
  return (
    <GlossaryTermView
      context={context}
      term={term}
      dates={getArticleDates(term, config.timezone)}
      body={renderPageBody<ReactNode>(term, bodyOptions)}
      crumbs={crumbs}
      jsonLd={jsonLd}
      articles={findArticlesLinkingTerm(articles, term.slug, bodyOptions)}
      cta={cta}
    />
  );
}

export function generateMethodMetadata(): Metadata {
  const config = getSoftureConfig();
  const context = getPageContext(config);
  const copy = context.messages.method;
  return getStaticMetadata(config, context, { title: copy.title, description: copy.description, path: context.routes.method });
}

/** "How our texts are made". Mount it with `blog({ methodPage: true })`; without that it is a 404. */
export function BlogMethodPage() {
  const config = getSoftureConfig();
  const context = getPageContext(config);
  if (context.methodPath === null) notFound();
  return <BlogMethodView context={context} />;
}

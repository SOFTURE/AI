// The pages' reads through Next's data cache: one query per key per `revalidateSeconds`, shared by the
// listing, the glossary and the metadata of a request. The listing and the glossary index render on
// every request (a build has no database), so without the cache every view would cost a query.
import type { SoftureConfig } from "@softure-ai/core";
import { unstable_cache } from "next/cache";
import type { BlogArticle } from "../contract.js";
import { findArticleBySlug, listArticles } from "../db/articles.js";
import { selectFeaturedArticles, type FeaturedArticlesOptions } from "../pages/listing.js";
import { readForStaticPage, type StaticReadOptions } from "../server/static-read.js";
import { getBlogOptions } from "../server/options.js";
import { getBlogContext } from "./context.js";

/** The tag of every cached read: `revalidateTag("softure-blog", { expire: 0 })` refreshes the blog at once (`refreshBlogCache`). */
export const BLOG_CACHE_TAG = "softure-blog";

interface CachedReads {
  readonly published: () => Promise<BlogArticle[]>;
  readonly bySlug: (slug: string) => Promise<BlogArticle | null>;
}

/**
 * The cache keeps JSON, so a `Date` comes back as a string: revive them, or every page served from
 * the cache would fail on its dates (FIRE's bug, kept fixed).
 */
function reviveDates(article: BlogArticle): BlogArticle {
  const toDate = (value: Date | string | null) => (value === null ? null : new Date(value));
  return { ...article, publishedAt: toDate(article.publishedAt), updatedAt: toDate(article.updatedAt), createdAt: new Date(article.createdAt) };
}

let reads: { readonly config: SoftureConfig; readonly value: CachedReads } | null = null;

function getCachedReads(config: SoftureConfig): CachedReads {
  if (reads?.config === config) return reads.value;
  const options = { revalidate: getBlogOptions(config).revalidateSeconds, tags: [BLOG_CACHE_TAG] };
  const value: CachedReads = {
    published: unstable_cache(async () => listArticles(await getBlogContext(config)), ["softure-blog", "published"], options),
    bySlug: unstable_cache(async (slug: string) => findArticleBySlug(await getBlogContext(config), slug), ["softure-blog", "by-slug"], options),
  };
  reads = { config, value };
  return value;
}

/** Published articles (not terms), newest first. */
export async function getPublishedArticles(config: SoftureConfig): Promise<BlogArticle[]> {
  return (await getCachedReads(config).published()).filter((text) => text.kind === "article").map(reviveDates);
}

/** Published glossary terms, in the store's order (pages sort them). */
export async function getPublishedTerms(config: SoftureConfig): Promise<BlogArticle[]> {
  return (await getCachedReads(config).published()).filter((text) => text.kind === "term").map(reviveDates);
}

/** The row under a slug in any status: the page decides what to show. */
export async function getTextBySlug(config: SoftureConfig, slug: string): Promise<BlogArticle | null> {
  const text = await getCachedReads(config).bySlug(slug);
  return text === null ? null : reviveDates(text);
}

/** Published articles for a featured strip: the pillars first, then the newest, at most `limit` (`selectFeaturedArticles`). */
export async function getFeaturedArticles(config: SoftureConfig, options: FeaturedArticlesOptions): Promise<BlogArticle[]> {
  return selectFeaturedArticles(await getPublishedArticles(config), options);
}

/**
 * Published articles for a prerendered page (a home page strip): none during `next build`, and none
 * (logged) when the database read fails, so the page still renders (`readForStaticPage`).
 */
export async function getStaticPublishedArticles(config: SoftureConfig, options: StaticReadOptions = {}): Promise<BlogArticle[]> {
  return readForStaticPage(() => getPublishedArticles(config), options);
}

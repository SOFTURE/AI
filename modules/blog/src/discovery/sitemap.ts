// The blog's entries for `@softure-ai/seo`'s sitemap (FIRE_TRACKER `src/lib/blog-discovery.ts`). Paths
// only: seo makes them absolute on its site origin with its canonical rule.
import type { BlogArticle } from "../contract.js";
import { getTermPath, getArticlePath, type BlogRoutes } from "../pages/paths.js";
import { getLatestModified, getTextLastModified } from "./dates.js";

/** The shape of seo's `SitemapEntry`, written out so the blog needs no seo import. */
export interface BlogSitemapEntry {
  readonly path: string;
  readonly lastModified?: Date;
  readonly priority: number;
}

export type SitemapText = Pick<BlogArticle, "slug" | "isPillar" | "publishedAt" | "updatedAt">;

export interface BlogSitemapInput {
  /** Published articles. */
  readonly articles: readonly SitemapText[];
  /** Published glossary terms. */
  readonly terms: readonly SitemapText[];
  readonly routes: BlogRoutes;
  /** The method page's path when the app mounts it, else `null`. */
  readonly methodPath: string | null;
}

const HUB_PRIORITY = 0.7;
const PILLAR_PRIORITY = 0.7;
const ARTICLE_PRIORITY = 0.6;
const GLOSSARY_PRIORITY = 0.5;
const METHOD_PRIORITY = 0.3;

/**
 * The listing and its articles, the glossary and its terms, and the method page. **An empty list adds
 * no hub**: an empty listing or glossary is `noindex`, and a sitemap pointing at a page kept out of the
 * index is a contradicting signal. The method page has no content date, so it has no `lastModified`.
 */
export function getBlogSitemapEntries({ articles, terms, routes, methodPath }: BlogSitemapInput): BlogSitemapEntry[] {
  const entries: BlogSitemapEntry[] = [];
  const listingModified = getLatestModified(articles);
  if (listingModified !== null) {
    entries.push(
      { path: routes.index, lastModified: listingModified, priority: HUB_PRIORITY },
      ...articles.map((article) => ({
        path: getArticlePath(routes, article.slug),
        lastModified: getTextLastModified(article),
        priority: article.isPillar ? PILLAR_PRIORITY : ARTICLE_PRIORITY,
      })),
    );
  }
  const glossaryModified = getLatestModified(terms);
  if (glossaryModified !== null) {
    entries.push(
      { path: routes.glossary, lastModified: glossaryModified, priority: GLOSSARY_PRIORITY },
      ...terms.map((term) => ({ path: getTermPath(routes, term.slug), lastModified: getTextLastModified(term), priority: GLOSSARY_PRIORITY })),
    );
  }
  if (methodPath !== null) entries.push({ path: methodPath, priority: METHOD_PRIORITY });
  return entries;
}

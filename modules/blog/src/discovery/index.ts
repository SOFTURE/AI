// Discovery without React and without Next: sitemap entries, the RSS feed, "read next", the IndexNow
// paths and submit, and the cache refresh request after a publish. The Next pieces
// (`../next/discovery.ts`, `../next/refresh.ts`) render and serve what it returns.
export { getLatestModified, getTextLastModified, type DatedText } from "./dates.js";
export { getIndexNowPaths, type IndexNowChange } from "./indexnow.js";
export {
  BLOG_REFRESH_RATE_LIMIT_BUCKET,
  BLOG_REFRESH_SECRET_ENV,
  MIN_REFRESH_SECRET_LENGTH,
  requestBlogRefresh,
  type BlogRefreshFailure,
  type BlogRefreshOutcome,
  type RequestBlogRefreshOptions,
} from "./refresh.js";
export { getRelatedArticles, PILLAR_RELATED_LIMIT, RELATED_LIMIT, type RelatedCandidate } from "./related.js";
export { buildBlogRss, escapeXml, type BuildBlogRssInput, type FeedChannel, type FeedText } from "./rss.js";
export { getBlogSitemapEntries, type BlogSitemapEntry, type BlogSitemapInput, type SitemapText } from "./sitemap.js";
export { submitBlogChanges, type BlogIndexNowOutcome, type BlogIndexNowSubmit, type SubmitBlogChangesOptions } from "./submit.js";

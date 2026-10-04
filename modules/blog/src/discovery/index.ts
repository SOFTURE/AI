// Discovery without React and without Next: sitemap entries, the RSS feed, "read next" and the
// IndexNow paths and submit. The Next pieces (`../next/discovery.ts`) render what it returns.
export { getLatestModified, getTextLastModified, type DatedText } from "./dates.js";
export { getIndexNowPaths, type IndexNowChange } from "./indexnow.js";
export { getRelatedArticles, PILLAR_RELATED_LIMIT, RELATED_LIMIT, type RelatedCandidate } from "./related.js";
export { buildBlogRss, escapeXml, type BuildBlogRssInput, type FeedChannel, type FeedText } from "./rss.js";
export { getBlogSitemapEntries, type BlogSitemapEntry, type BlogSitemapInput, type SitemapText } from "./sitemap.js";
export { submitBlogChanges, type BlogIndexNowOutcome, type BlogIndexNowSubmit, type SubmitBlogChangesOptions } from "./submit.js";

// Page logic without React and without Next: paths, dates, listing order, crumbs, JSON-LD and the
// 301/410 decisions. The components (`../ui/`) and the Next adapter (`../next/`) render what it returns.
export { findArticlesLinkingTerm, renderPageBody, type RenderPageBodyOptions } from "./body.js";
export { formatDay, getArticleDates, getDayInZone, type ArticleDates } from "./dates.js";
export { getArticleImageUrl, getArticleJsonLd, getGlossaryJsonLd, getTermJsonLd, serializeJsonLd, type JsonLdContext } from "./json-ld.js";
export {
  getArticleCrumbs,
  getClusterAnchor,
  getClusterLabel,
  getTermCrumbs,
  groupByCluster,
  sortTerms,
  splitClusterLead,
  type ClusterGroup,
  type Crumb,
  type CrumbLabels,
} from "./listing.js";
export {
  getArticlePath,
  getReservedSlugs,
  getTermPath,
  getTextPath,
  matchBlogPath,
  normalizeRoute,
  type BlogPathKind,
  type BlogPathMatch,
  type BlogRoutes,
} from "./paths.js";
export {
  buildGonePage,
  createCachedBlogPathDecider,
  decideBlogPath,
  type BlogPathDecision,
  type BlogPathLookup,
  type CachedDeciderOptions,
  type GonePageCopy,
} from "./redirects.js";

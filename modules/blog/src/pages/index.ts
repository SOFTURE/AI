// Page logic without React and without Next: paths, dates, listing order, crumbs, JSON-LD and the
// 301/410 decisions. The components (`../ui/`) and the Next adapter (`../next/`) render what it returns.
export { findArticlesLinkingTerm, renderPageBody, type RenderPageBodyOptions } from "./body.js";
export { formatDay, getArticleDates, getDayInZone, type ArticleDates } from "./dates.js";
export { DEFAULT_JSON_LD_IDS, getArticleImageUrl, getArticleJsonLd, getGlossaryJsonLd, getTermJsonLd, serializeJsonLd, type JsonLdContext, type JsonLdIds } from "./json-ld.js";
export {
  DEFAULT_CLUSTER_ANCHOR_PREFIX,
  getArticleCrumbs,
  getClusterAnchor,
  getClusterLabel,
  getTermCrumbs,
  groupByCluster,
  selectFeaturedArticles,
  sortTerms,
  splitClusterLead,
  type ArticleCrumbOptions,
  type ClusterGroup,
  type Crumb,
  type CrumbLabels,
  type FeaturedArticlesOptions,
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
  type GonePageLink,
  type GonePageOptions,
  type GonePageRenderInput,
} from "./redirects.js";

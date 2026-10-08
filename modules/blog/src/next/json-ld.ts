// The structured data of the blog's pages, ready for `<script type="application/ld+json">`: built from
// what the caller already holds (no database read, no request scope) and serialized so no text can
// close the tag. The ready-made pages use these; an app with its own page components mounts them as
//
//   <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: buildArticleJsonLd(config, article) }} />
import { getSiteUrls, type SoftureConfig } from "@softure-ai/core";
import type { BlogArticle } from "../contract.js";
import { getArticleJsonLd, getGlossaryJsonLd, getTermJsonLd, serializeJsonLd, type JsonLdContext } from "../pages/json-ld.js";
import { getArticleCrumbs, getClusterLabel, getTermCrumbs, sortTerms, type CrumbLabels } from "../pages/listing.js";
import { getBlogOptions } from "../server/options.js";
import type { BlogPageContext } from "../ui/page-context.js";
import { getPageContext } from "./context.js";

/** The breadcrumb names the pages show: the blog, the glossary and the clusters' display names. */
export function getCrumbLabels(config: SoftureConfig, context: BlogPageContext = getPageContext(config)): CrumbLabels {
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

/** An article's `BlogPosting`, breadcrumbs and FAQ, serialized. */
export function buildArticleJsonLd(config: SoftureConfig, article: BlogArticle): string {
  const context = getPageContext(config);
  const crumbs = getArticleCrumbs(article, context.routes, getCrumbLabels(config, context));
  return serializeJsonLd(getArticleJsonLd(article, crumbs, getJsonLdContext(config, context)));
}

/** A glossary term's `DefinedTerm` and breadcrumbs, serialized. */
export function buildTermJsonLd(config: SoftureConfig, term: BlogArticle): string {
  const context = getPageContext(config);
  const crumbs = getTermCrumbs(term, context.routes, getCrumbLabels(config, context));
  return serializeJsonLd(getTermJsonLd(term, crumbs, getJsonLdContext(config, context), context.messages.glossary.title));
}

/** The glossary's `DefinedTermSet` over the published terms, in the index's order, serialized; `null` without terms. */
export function buildGlossaryJsonLd(config: SoftureConfig, terms: readonly BlogArticle[]): string | null {
  if (terms.length === 0) return null;
  const context = getPageContext(config);
  return serializeJsonLd(getGlossaryJsonLd(sortTerms(terms, config.locale), getJsonLdContext(config, context), context.messages.glossary.title));
}

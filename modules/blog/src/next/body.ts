// The body input of the blog's pages, bound to the config: the glossary from the published terms, the
// routes, the blog options, the site's own origins and the copy. The ready-made pages render with it,
// and an app with its own page components uses the same function, so its "explained in these texts"
// list and its body links follow the same rule as the package's pages:
//
//   const articles = findArticlesLinkingTermFor(config, { articles: published, termSlug: term.slug, terms });
//   const body = renderPageBody(term, getBodyOptions(config, terms));
import { getSiteUrls, type SoftureConfig } from "@softure-ai/core";
import type { BlogArticle } from "../contract.js";
import { findArticlesLinkingTerm, type RenderPageBodyOptions } from "../pages/body.js";
import { toGlossary } from "../render/glossary.js";
import { getBlogOptions } from "../server/options.js";
import type { BlogPageContext } from "../ui/page-context.js";
import { getPageContext } from "./context.js";

/** What `renderPageBody` and `findArticlesLinkingTerm` (`/server`) take, as the ready-made pages build it. */
export function getBodyOptions(config: SoftureConfig, terms: readonly BlogArticle[], context: BlogPageContext = getPageContext(config)): RenderPageBodyOptions {
  const origins = [config.appOrigin, getSiteUrls(config).origin];
  return { glossary: toGlossary(terms), routes: context.routes, options: getBlogOptions(config), origins, messages: context.messages };
}

export interface ArticlesLinkingTermInput {
  /** The published articles to look through, e.g. `getPublishedArticles(config)`. */
  readonly articles: readonly BlogArticle[];
  readonly termSlug: string;
  /** The published terms, e.g. `getPublishedTerms(config)`: the glossary the bodies link. */
  readonly terms: readonly BlogArticle[];
}

/** The published articles whose body links the term: the list under a glossary term's page. */
export function findArticlesLinkingTermFor(config: SoftureConfig, input: ArticlesLinkingTermInput): BlogArticle[] {
  return findArticlesLinkingTerm(input.articles, input.termSlug, getBodyOptions(config, input.terms));
}

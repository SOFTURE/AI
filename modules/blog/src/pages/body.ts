// A stored text's body rendered for its page: the renderer with the app's glossary, block plugins,
// hosts and image policy, and the module's copy. A term page passes the term itself, so it never links
// to itself.
import type { BlogArticle } from "../contract.js";
import type { BlogMessages } from "../messages/index.js";
import type { BlogOptions } from "../options.js";
import type { GlossaryTerm } from "../render/glossary.js";
import { findLinkedTerms, renderArticle, type BlockPlugin, type RenderArticleOptions, type RenderedArticle } from "../render/render-article.js";
import { getTermPath, type BlogRoutes } from "./paths.js";

export interface RenderPageBodyOptions {
  readonly glossary: readonly GlossaryTerm[];
  readonly routes: BlogRoutes;
  readonly options: Pick<BlogOptions, "blocks" | "images" | "siteHosts"> & Partial<Pick<BlogOptions, "externalLinkMarker">>;
  /** The app's own origins (`appOrigin` and the canonical site origin); their hosts are the site's (links to them are not external). */
  readonly origins: readonly string[];
  readonly messages: BlogMessages;
}

/** The renderer's options for a text's page body: shared by the render and the link search, so they never drift. */
function getRenderOptions<TNode>(text: BlogArticle, input: RenderPageBodyOptions): RenderArticleOptions<TNode> {
  return {
    glossary: input.glossary,
    ...(text.kind === "term" ? { selfSlug: text.slug } : {}),
    termHref: (slug) => getTermPath(input.routes, slug),
    siteHosts: [...input.origins.map((origin) => new URL(origin).hostname), ...input.options.siteHosts],
    ...(input.options.images === undefined ? {} : { images: input.options.images }),
    // The options keep plugins untyped (`unknown` nodes); the pages render React nodes, the type the
    // app's plugins return.
    blocks: input.options.blocks as readonly BlockPlugin<TNode>[],
    article: { currentAsOf: text.currentAsOf, fields: text.fields },
    ...(input.options.externalLinkMarker === undefined ? {} : { externalMarker: input.options.externalLinkMarker }),
    messages: input.messages.render,
  };
}

export function renderPageBody<TNode = unknown>(text: BlogArticle, input: RenderPageBodyOptions): RenderedArticle<TNode> {
  return renderArticle<TNode>(text.bodyMarkdown, getRenderOptions<TNode>(text, input));
}

/**
 * Published articles whose body links the term, by hand or by its first mention: the same rule as the links.
 * Reads the links without rendering, so no block plugin runs.
 */
export function findArticlesLinkingTerm(articles: readonly BlogArticle[], termSlug: string, input: RenderPageBodyOptions): BlogArticle[] {
  return articles.filter((article) => findLinkedTerms(article.bodyMarkdown, getRenderOptions(article, input)).includes(termSlug));
}

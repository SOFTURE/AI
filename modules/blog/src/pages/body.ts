// A stored text's body rendered for its page: the renderer with the app's glossary, block plugins and
// hosts, and the module's copy. A term page passes the term itself, so it never links to itself.
import type { BlogArticle } from "../contract.js";
import type { BlogMessages } from "../messages/index.js";
import type { BlogOptions } from "../options.js";
import type { GlossaryTerm } from "../render/glossary.js";
import { renderArticle, type BlockPlugin, type RenderedArticle } from "../render/render-article.js";
import { getTermPath, type BlogRoutes } from "./paths.js";

export interface RenderPageBodyOptions {
  readonly glossary: readonly GlossaryTerm[];
  readonly routes: BlogRoutes;
  readonly options: Pick<BlogOptions, "blocks" | "siteHosts">;
  /** The app's origin; its host is the site's own (links to it are not external). */
  readonly origin: string;
  readonly messages: BlogMessages;
}

export function renderPageBody<TNode = unknown>(text: BlogArticle, input: RenderPageBodyOptions): RenderedArticle<TNode> {
  return renderArticle<TNode>(text.bodyMarkdown, {
    glossary: input.glossary,
    ...(text.kind === "term" ? { selfSlug: text.slug } : {}),
    termHref: (slug) => getTermPath(input.routes, slug),
    siteHosts: [new URL(input.origin).hostname, ...input.options.siteHosts],
    // The options keep plugins untyped (`unknown` nodes); the pages render React nodes, the type the
    // app's plugins return.
    blocks: input.options.blocks as readonly BlockPlugin<TNode>[],
    article: { currentAsOf: text.currentAsOf, fields: text.fields },
    messages: input.messages.render,
  });
}

/** Published articles whose body links the term, by hand or by its first mention: the same rule as the links. */
export function findArticlesLinkingTerm(articles: readonly BlogArticle[], termSlug: string, input: RenderPageBodyOptions): BlogArticle[] {
  return articles.filter((article) => renderPageBody(article, input).linkedTerms.includes(termSlug));
}

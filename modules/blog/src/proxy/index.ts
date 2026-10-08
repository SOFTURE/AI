// The proxy piece of @softure-ai/blog: 301 from an old slug, 410 for a withdrawn text, before the page
// (docs/02-module-standard.md §8, the ID-3 pattern). It uses only Web `Request` and `Response`, and it
// is async (it may query the database), so the app awaits it first in its `proxy.ts`:
//
//   const blogRedirects = createBlogRedirects(softureConfig);
//   export async function proxy(request: NextRequest) {
//     return (await blogRedirects(request)) ?? guard(request) ?? NextResponse.next();
//   }
//
// Next 16 runs `proxy.ts` on Node.js, so the database handle is the process-wide one.
//
// `createBlogMarkdown` answers an article or term page asked for with `Accept: text/markdown` with the
// text as Markdown; put it before the redirects so a moved or withdrawn text still answers as before:
//
//   return (await blogMarkdown(request)) ?? (await blogRedirects(request)) ?? …
import { systemClock, type SoftureConfig } from "@softure-ai/core";
import { getConfiguredDatabase } from "@softure-ai/db";
import { findArticleBySlug, findSlugRedirect, getPublishedArticle, type BlogContext } from "../db/articles.js";
import { prefersMarkdown } from "../pages/accept.js";
import { toArticleMarkdown } from "../render/article-markdown.js";
import { matchBlogPath } from "../pages/paths.js";
import { buildGonePage, createCachedBlogPathDecider, type BlogPathLookup, type CachedDeciderOptions } from "../pages/redirects.js";
import { getBlogMessages, getBlogOptions, getBlogReservedSlugs, getBlogRoutes } from "../server/options.js";

export { prefersMarkdown };

export type BlogRedirects = (request: Request) => Promise<Response | null>;

export interface BlogRedirectsOptions extends CachedDeciderOptions {
  /** The store's context; the shared database handle of `config.database` by default (tests pass PGlite). */
  readonly getContext?: () => Promise<BlogContext>;
}

function createDefaultContext(config: SoftureConfig): () => Promise<BlogContext> {
  return async () => {
    if (config.database === null) throw new Error("@softure-ai/blog: softure.config.ts has no database; the blog needs one");
    const { db } = await getConfiguredDatabase(config.database);
    return { db, clock: systemClock, config };
  };
}

/**
 * Answers a request for a text's address: 301 to the current path (the query kept) for an old slug
 * or a text under the other kind's path, 410 with a short page for a withdrawn text, `null` for
 * everything else (the next piece or the page answers). Only GET and HEAD are considered.
 */
export function createBlogRedirects(config: SoftureConfig, options: BlogRedirectsOptions = {}): BlogRedirects {
  const routes = getBlogRoutes(config);
  const reservedSlugs = getBlogReservedSlugs(config);
  const getContext = options.getContext ?? createDefaultContext(config);
  const lookup: BlogPathLookup = {
    findText: async (slug) => findArticleBySlug(await getContext(), slug),
    findRedirect: async (oldSlug) => findSlugRedirect(await getContext(), oldSlug),
  };
  const decide = createCachedBlogPathDecider(routes, lookup, options);
  const gonePage = renderGonePage(config, routes.index);

  return async (request) => {
    if (request.method !== "GET" && request.method !== "HEAD") return null;
    const url = new URL(request.url);
    const match = matchBlogPath(url.pathname, routes, reservedSlugs);
    if (match === null) return null;
    const decision = await decide(match);
    if (decision.kind === "redirect") {
      const target = new URL(decision.path, url);
      target.search = url.search;
      // 301, not 308: what the roadmap asks for and what every crawler reads as a move.
      return Response.redirect(target, 301);
    }
    if (decision.kind === "gone") {
      return new Response(request.method === "HEAD" ? null : gonePage, { status: 410, headers: { "content-type": "text/html; charset=utf-8" } });
    }
    return null;
  };
}

/** The 410 body: the app's `gonePage.render` when given, else the module's page with the app's links. */
function renderGonePage(config: SoftureConfig, indexPath: string): string {
  const { gonePage } = getBlogOptions(config);
  const links = gonePage.links.map((link) => ({ href: link.href, label: link.label[config.locale] ?? link.label.en }));
  const input = { copy: getBlogMessages(config).gone, lang: config.locale, indexPath, links };
  return gonePage.render === undefined ? buildGonePage(input.copy, input) : gonePage.render(input);
}

export type BlogMarkdown = (request: Request) => Promise<Response | null>;

export interface BlogMarkdownOptions {
  /** The store's context; the shared database handle of `config.database` by default (tests pass PGlite). */
  readonly getContext?: () => Promise<BlogContext>;
  /** Where a failed read is reported; `console.error` by default. The request then goes on to the page. */
  readonly onError?: (message: string) => void;
}

const MARKDOWN_HEADERS = {
  "content-type": "text/markdown; charset=utf-8",
  // One address, two representations. `private`: a shared cache must not hand Markdown to a browser.
  vary: "Accept",
  "cache-control": "private, max-age=0, must-revalidate",
};

/**
 * Answers a GET or HEAD of a published article or term whose `Accept` asks for Markdown
 * (`prefersMarkdown`) with the text as Markdown (`toArticleMarkdown`, the app's block plugins giving
 * their Markdown form). `null` for everything else, and when the read fails: the page answers then.
 */
export function createBlogMarkdown(config: SoftureConfig, options: BlogMarkdownOptions = {}): BlogMarkdown {
  const routes = getBlogRoutes(config);
  const reservedSlugs = getBlogReservedSlugs(config);
  const getContext = options.getContext ?? createDefaultContext(config);
  const onError = options.onError ?? ((message: string) => console.error(message));
  const { blocks } = getBlogOptions(config);
  const messages = getBlogMessages(config).pages;

  return async (request) => {
    if (request.method !== "GET" && request.method !== "HEAD") return null;
    if (!prefersMarkdown(request.headers.get("accept"))) return null;
    const url = new URL(request.url);
    const match = matchBlogPath(url.pathname, routes, reservedSlugs);
    if (match === null) return null;
    let article;
    try {
      article = await getPublishedArticle(await getContext(), match.slug);
    } catch (error) {
      onError(`@softure-ai/blog: reading ${url.pathname} as Markdown failed: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
    if (article?.kind !== match.kind) return null;
    const body = toArticleMarkdown(article, { blocks, messages });
    const headers = { ...MARKDOWN_HEADERS, "x-markdown-tokens": String(Math.ceil(body.length / 4)) };
    return new Response(request.method === "HEAD" ? null : body, { status: 200, headers });
  };
}

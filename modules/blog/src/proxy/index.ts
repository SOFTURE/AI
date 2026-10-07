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
import { systemClock, type SoftureConfig } from "@softure-ai/core";
import { getConfiguredDatabase } from "@softure-ai/db";
import { findArticleBySlug, findSlugRedirect, type BlogContext } from "../db/articles.js";
import { matchBlogPath } from "../pages/paths.js";
import { buildGonePage, createCachedBlogPathDecider, type BlogPathLookup, type CachedDeciderOptions } from "../pages/redirects.js";
import { getBlogMessages, getBlogReservedSlugs, getBlogRoutes } from "../server/options.js";

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
  const gonePage = buildGonePage(getBlogMessages(config).gone, { lang: config.locale, indexPath: routes.index });

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

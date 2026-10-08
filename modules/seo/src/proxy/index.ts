// The proxy piece of @softure-ai/seo: the Markdown version of every public page for agents
// (docs/02-module-standard.md §8). A GET or HEAD of a sitemap page whose `Accept` asks for Markdown
// (`prefersMarkdown`) is answered with the page's main content as Markdown; the page is rendered by a
// request to the app's own server, as an anonymous visitor sees it. It uses only Web `Request` and
// `Response`, so it chains in the app's `proxy.ts`, after the blog's own Markdown piece (which answers
// from the stored text) and before a route guard:
//
//   const pageMarkdown = createPageMarkdown(softureConfig);
//   export async function proxy(request: NextRequest) {
//     return (await blogMarkdown(request)) ?? (await pageMarkdown(request)) ?? guard(request) ?? NextResponse.next();
//   }
import { getModule, type SoftureConfig } from "@softure-ai/core";
import { prefersMarkdown } from "../accept.js";
import { MODULE_ID } from "../index.js";
import type { SeoOptions } from "../options.js";
import { htmlToMarkdown } from "../server/html-to-markdown.js";
import { buildCanonicalUrl, resolveSeoSettings, type SeoRoutes, type SeoSettings } from "../settings.js";
import { buildSitemap } from "../sitemap.js";

export { prefersMarkdown };

export type PageMarkdown = (request: Request) => Promise<Response | null>;

export interface PageMarkdownOptions {
  /**
   * Which paths have a Markdown version. By default exactly the sitemap's pages (the app's entries and the
   * contributors'), compared by canonical URL; pass a predicate to choose otherwise.
   */
  readonly paths?: (pathname: string) => boolean | Promise<boolean>;
  /** How long the sitemap's pages are kept, in seconds; `0` reads them on every request. Default 60. */
  readonly cacheSeconds?: number;
  /**
   * Where the app's own server listens, for the internal render: `http://127.0.0.1:${PORT ?? 3000}` by default.
   * Not the request's URL: behind a reverse proxy that is the public host.
   */
  readonly selfOrigin?: string;
  /** More selectors to drop from the page, e.g. a footnote's back link (`htmlToMarkdown`'s `remove`). */
  readonly remove?: readonly string[];
  /** The element converted, `main` by default. */
  readonly root?: string;
  /** Where a failed render is reported; `console.error` by default. The page then answers the request. */
  readonly onError?: (message: string) => void;
  /** The fetch used for the internal render; the global one by default (tests pass their own). */
  readonly fetch?: typeof fetch;
  /** The clock of the sitemap cache, in milliseconds; `Date.now` by default. */
  readonly now?: () => number;
}

/** Marks the internal render, so this piece never answers its own request. */
export const PAGE_MARKDOWN_HEADER = "x-softure-seo-markdown";

const DEFAULT_CACHE_SECONDS = 60;

const MARKDOWN_HEADERS = {
  "content-type": "text/markdown; charset=utf-8",
  // One address, two representations. `private`: a shared cache must not hand Markdown to a browser.
  vary: "Accept",
  "cache-control": "private, max-age=0, must-revalidate",
};

function getConfiguredSettings(config: SoftureConfig): SeoSettings {
  const module = getModule(config, MODULE_ID);
  if (module === undefined) {
    throw new Error("@softure-ai/seo: the seo module is not enabled; add seo() to modules in softure.config.ts");
  }
  // The module factory parsed the options and declares both routes.
  return resolveSeoSettings(module.options as SeoOptions, { appOrigin: config.appOrigin, routes: module.routes as unknown as SeoRoutes });
}

/** The error's message and its cause's (`fetch` puts the refused connection there). No personal data here. */
function describeError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  return error.cause instanceof Error ? `${error.message} (${error.cause.message})` : error.message;
}

function getDefaultSelfOrigin(): string {
  return `http://127.0.0.1:${process.env.PORT ?? "3000"}`;
}

/**
 * Whether a path is a sitemap page, the sitemap read at most once per `cacheSeconds`. The cache holds the
 * pending read, so concurrent requests share one run of the contributors.
 */
function createSitemapPaths(settings: SeoSettings, cacheSeconds: number, now: () => number): (pathname: string) => Promise<boolean> {
  let cached: { readonly urls: Promise<Set<string>>; readonly expiresAt: number } | null = null;
  return async (pathname) => {
    if (cached === null || now() >= cached.expiresAt) {
      const urls = buildSitemap(settings).then((entries) => new Set(entries.map((entry) => entry.url)));
      cached = { urls, expiresAt: now() + cacheSeconds * 1000 };
    }
    return (await cached.urls).has(buildCanonicalUrl(pathname, settings));
  };
}

/**
 * Answers a GET or HEAD of a sitemap page whose `Accept` asks for Markdown with the page's main element as
 * Markdown (`htmlToMarkdown`). `null` for everything else, and whenever the page does not render as a 200
 * HTML page with that element (a redirect, a 404, an error): the page then answers the request itself.
 */
export function createPageMarkdown(config: SoftureConfig, options: PageMarkdownOptions = {}): PageMarkdown {
  const settings = getConfiguredSettings(config);
  const cacheSeconds = options.cacheSeconds ?? DEFAULT_CACHE_SECONDS;
  if (!Number.isFinite(cacheSeconds) || cacheSeconds < 0) {
    throw new Error(`@softure-ai/seo: createPageMarkdown cacheSeconds must be 0 or more, got ${String(cacheSeconds)}`);
  }
  const isPagePath = options.paths ?? createSitemapPaths(settings, cacheSeconds, options.now ?? Date.now);
  const onError = options.onError ?? ((message: string) => console.error(message));
  const fetchPage = options.fetch ?? fetch;

  return async (request) => {
    if (request.method !== "GET" && request.method !== "HEAD") return null;
    if (request.headers.has(PAGE_MARKDOWN_HEADER)) return null;
    if (!prefersMarkdown(request.headers.get("accept"))) return null;
    const { pathname } = new URL(request.url);
    // `//host/x` is a valid pathname that `new URL(pathname, base)` reads as another host.
    if (pathname.startsWith("//")) return null;
    try {
      if (!(await isPagePath(pathname))) return null;
    } catch (error) {
      onError(`@softure-ai/seo: deciding whether ${pathname} has a Markdown version failed: ${describeError(error)}`);
      return null;
    }

    const selfOrigin = options.selfOrigin ?? getDefaultSelfOrigin();
    let page: Response;
    try {
      // Only these headers: no cookie and no authorization, so the render is the anonymous page and nothing
      // behind a session is reachable this way. The query is dropped: one Markdown per address.
      const target = new URL(selfOrigin);
      target.pathname = pathname;
      page = await fetchPage(target, {
        headers: { accept: "text/html", [PAGE_MARKDOWN_HEADER]: "1" },
        redirect: "manual",
        cache: "no-store",
      });
    } catch (error) {
      onError(`@softure-ai/seo: rendering ${pathname} as Markdown failed: ${describeError(error)}`);
      return null;
    }
    if (page.status !== 200 || !(page.headers.get("content-type") ?? "").includes("text/html")) {
      return null;
    }

    const body = htmlToMarkdown(await page.text(), {
      root: options.root ?? "main",
      origin: settings.siteOrigin,
      url: buildCanonicalUrl(pathname, settings),
      remove: options.remove ?? [],
    });
    if (body === null) {
      onError(`@softure-ai/seo: page ${pathname} has no ${options.root ?? "main"} element, so it has no Markdown version`);
      return null;
    }
    const headers = { ...MARKDOWN_HEADERS, "x-markdown-tokens": String(Math.ceil(body.length / 4)) };
    return new Response(request.method === "HEAD" ? null : body, { status: 200, headers });
  };
}

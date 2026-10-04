// One resolved view of the module's options: the site origin every absolute URL is built on, and
// the canonical URL rule. robots, the sitemap, `metadata.alternates.canonical` and IndexNow all read
// it, so a page cannot be listed under one host and canonicalised under another.
import type { SeoOptions } from "./options.js";

export interface SeoRoutes {
  readonly sitemap: string;
  readonly indexNowKey: string;
}

export interface SeoSettings {
  /** Scheme and host (and port) of the public site, after the canonical host rule. */
  readonly siteOrigin: string;
  readonly trailingSlash: boolean;
  readonly robots: SeoOptions["robots"];
  readonly crawlers: SeoOptions["crawlers"];
  readonly sitemap: SeoOptions["sitemap"];
  readonly indexNowKey: string | null;
  readonly routes: SeoRoutes;
}

const WWW_PREFIX = "www.";

/** Settings from the module's parsed options, the config's `appOrigin` and the module's routes. */
export function resolveSeoSettings(options: SeoOptions, input: { appOrigin: string; routes: SeoRoutes }): SeoSettings {
  return {
    siteOrigin: getSiteOrigin(options.origin ?? input.appOrigin, options.canonical.host),
    trailingSlash: options.canonical.trailingSlash,
    robots: options.robots,
    crawlers: options.crawlers,
    sitemap: options.sitemap,
    indexNowKey: options.indexNow?.key ?? null,
    routes: input.routes,
  };
}

/** The origin with the canonical host rule applied: `apex` drops one leading `www.`, `www` adds it. */
export function getSiteOrigin(origin: string, host: "as-is" | "apex" | "www"): string {
  const url = new URL(origin);
  if (host === "apex" && url.hostname.startsWith(WWW_PREFIX)) {
    url.hostname = url.hostname.slice(WWW_PREFIX.length);
  }
  if (host === "www" && !url.hostname.startsWith(WWW_PREFIX)) {
    url.hostname = `${WWW_PREFIX}${url.hostname}`;
  }
  return url.origin;
}

/**
 * The absolute canonical URL of a path: on the site origin, with the trailing slash rule applied
 * (the root stays `/`), without query or hash. For `metadata.alternates.canonical` and the sitemap.
 */
export function buildCanonicalUrl(path: string, settings: Pick<SeoSettings, "siteOrigin" | "trailingSlash">): string {
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new Error(`buildCanonicalUrl: "${path}" is not a path on the site; pass a path starting with a single /`);
  }
  const url = new URL(path, settings.siteOrigin);
  url.search = "";
  url.hash = "";
  if (url.pathname !== "/") {
    const bare = url.pathname.replace(/\/+$/, "");
    url.pathname = settings.trailingSlash ? `${bare}/` : bare;
  }
  return url.toString();
}

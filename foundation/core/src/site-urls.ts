// The site-URL contract (docs/02-module-standard.md §7): a module builds the absolute URLs its pages
// declare (canonical, Open Graph, JSON-LD, feeds) without importing the module that owns the canonical
// rule. One enabled module provides the rule (`@softure-ai/seo`); without one, every URL is built on the
// config's `appOrigin`.
import type { SoftureConfig } from "./config.js";

export interface SiteUrls {
  /** Scheme and host (and port) of the public site, e.g. `https://example.com`. For files such as feeds and images. */
  readonly origin: string;
  /** The absolute canonical URL of a page's path (a path starting with a single `/`). */
  readonly getCanonicalUrl: (path: string) => string;
}

/** Builds the app's site URLs from its config. */
export type SiteUrlProvider = (config: SoftureConfig) => SiteUrls;

/** The provider of the enabled module that has one, or `null` when none does. */
export function findSiteUrlProvider(config: SoftureConfig): SiteUrlProvider | null {
  // `typeof`, not `!== null`: a module built by an older core has no such field at all.
  for (const module of config.modules) {
    if (typeof module.siteUrls === "function") return module.siteUrls;
  }
  return null;
}

/** The app's site URLs: the provider's, else the path appended to `appOrigin` unchanged. */
export function getSiteUrls(config: SoftureConfig): SiteUrls {
  const provider = findSiteUrlProvider(config);
  if (provider !== null) return provider(config);
  const origin = config.appOrigin;
  return {
    origin,
    getCanonicalUrl: (path) => {
      if (!path.startsWith("/") || path.startsWith("//")) {
        throw new Error(`getCanonicalUrl: "${path}" is not a path on the site; pass a path starting with a single /`);
      }
      return `${origin}${path}`;
    },
  };
}

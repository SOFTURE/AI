// Public API of @softure-ai/seo: the module factory for softure.config.ts, the pure builders and
// the crawler lists. The Next files an app mounts are in `@softure-ai/seo/next`, the IndexNow
// submit in `@softure-ai/seo/server`.
import { defineModule, getModule, type SiteUrls, type SoftureConfig } from "@softure-ai/core";
import { seoMessages } from "./messages/index.js";
import { seoOptionsSchema, type SeoOptions } from "./options.js";
import { buildCanonicalUrl, resolveSeoSettings, type SeoRoutes } from "./settings.js";

export const MODULE_ID = "seo";

/**
 * The site URLs other modules build on through core's `getSiteUrls` (the blog's canonical, OG and JSON-LD
 * URLs): seo's site origin and its canonical host and trailing-slash rule, as in the sitemap.
 */
export function getSeoSiteUrls(config: SoftureConfig): SiteUrls {
  const module = getModule(config, MODULE_ID);
  if (module === undefined) {
    // Unreachable through core: it asks only a listed module.
    throw new Error("@softure-ai/seo: the seo module is not enabled; add seo() to modules in softure.config.ts");
  }
  // The module factory parsed the options and declares both routes.
  const settings = resolveSeoSettings(module.options as SeoOptions, { appOrigin: config.appOrigin, routes: module.routes as unknown as SeoRoutes });
  return { origin: settings.siteOrigin, getCanonicalUrl: (path) => buildCanonicalUrl(path, settings) };
}

/**
 * Enables robots.txt, sitemap.xml and the IndexNow key file in `softure.config.ts`, e.g.
 * `seo({ robots: { disallow: ["/account"] }, indexNow: { key: "..." } })`. Mount
 * `app/robots.ts`, `app/sitemap.ts` and `app/indexnow-key.txt/route.ts` from `@softure-ai/seo/next`.
 */
export const seo = defineModule({
  manifest: {
    id: MODULE_ID,
    version: "0.1.1",
    dependsOn: {},
    dbSchema: null,
    tables: [],
    env: [],
    switches: [],
    routes: { sitemap: "/sitemap.xml", indexNowKey: "/indexnow-key.txt" },
    mount: [
      { kind: "route-handler", path: "app/robots.ts", export: "robots" },
      { kind: "route-handler", path: "app/sitemap.ts", export: "sitemap" },
      { kind: "route-handler", path: "app/indexnow-key.txt/route.ts", export: "serveIndexNowKey" },
    ],
    privacy: { exports: false, deletes: false },
  },
  messages: seoMessages,
  options: seoOptionsSchema,
  siteUrls: getSeoSiteUrls,
});

export {
  AI_HTML_LIMITED_BOTS,
  AI_ON_DEMAND_FETCHERS,
  AI_SEARCH_CRAWLERS,
  AI_TRAINING_CRAWLERS,
  buildHtmlLimitedBots,
  NEXT_DEFAULT_HTML_LIMITED_BOTS,
} from "./crawlers.js";
export { seoMessages, type SeoMessages } from "./messages/index.js";
export type { SeoOptions, SeoOptionsInput } from "./options.js";
export { buildRobots, type Robots, type RobotsRule } from "./robots.js";
export { buildSitemap, type BuildSitemapOptions, type SitemapContributor, type SitemapContributorContext, type SitemapEntry, type SitemapUrl } from "./sitemap.js";
export { buildCanonicalUrl, getSiteOrigin, resolveSeoSettings, type SeoRoutes, type SeoSettings } from "./settings.js";

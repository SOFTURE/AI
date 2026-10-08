// The blog options, routes and copy of the running app, read from the configuration.
import { getModule, getSiteUrls, type AnySoftureModule, type SoftureConfig } from "@softure-ai/core";
import type { BlogMessages } from "../messages/index.js";
import type { BlogOptions } from "../options.js";
import { getReservedSlugs, normalizeRoute, type BlogRoutes } from "../pages/paths.js";
import { resolveQualitySettings, type QualitySettings } from "../quality/settings.js";

const MODULE_ID = "blog";

/** The enabled module. Throws when the app did not enable it: calling its functions then is a bug. */
function getBlogModule(config: SoftureConfig): AnySoftureModule {
  const module = getModule(config, MODULE_ID);
  if (module === undefined) {
    throw new Error("@softure-ai/blog: the module is not enabled; add blog() to modules in softure.config.ts");
  }
  return module;
}

export function getBlogOptions(config: SoftureConfig): BlogOptions {
  // The module factory parsed these options with blogOptionsSchema.
  return getBlogModule(config).options as BlogOptions;
}

/** The module's copy in the app's locale, with the app's overrides applied. */
export function getBlogMessages(config: SoftureConfig): BlogMessages {
  // The module factory merged the dictionaries; their shape is the module's own.
  return getBlogModule(config).messages[config.locale] as BlogMessages;
}

/** The module's routes with the app's overrides applied, without trailing slashes. */
export function getBlogRoutes(config: SoftureConfig): BlogRoutes {
  const routes = getBlogModule(config).routes;
  const read = (name: keyof BlogRoutes): string => {
    const path = routes[name];
    // The manifest declares every route, so a missing one means a broken module definition.
    if (path === undefined) throw new Error(`@softure-ai/blog: route "${name}" is missing from the module manifest`);
    return normalizeRoute(path);
  };
  return { index: read("index"), glossary: read("glossary"), method: read("method"), rss: read("rss") };
}

/** The path of the cache refresh route (`refreshBlogCache`), outside the pages' routes. */
export function getBlogRefreshPath(config: SoftureConfig): string {
  const path = getBlogModule(config).routes.refresh;
  // The manifest declares the route, so a missing one means a broken module definition.
  if (path === undefined) throw new Error('@softure-ai/blog: route "refresh" is missing from the module manifest');
  return normalizeRoute(path);
}

/** The slugs no article may take: the app's `reservedSlugs` and the static pages under the listing. */
export function getBlogReservedSlugs(config: SoftureConfig): string[] {
  const options = getBlogOptions(config);
  return getReservedSlugs(getBlogRoutes(config), options);
}

/** The quality gate's settings, or `null` when the app turned the gate off (`quality: false`). */
export function getQualitySettings(config: SoftureConfig): QualitySettings | null {
  const { quality, images } = getBlogOptions(config);
  if (quality === false) return null;
  const site = { appOrigin: config.appOrigin, siteOrigin: getSiteUrls(config).origin, timezone: config.timezone, routes: getBlogRoutes(config) };
  return resolveQualitySettings(quality, site, images ?? null);
}

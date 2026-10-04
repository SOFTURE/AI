// Reads the seo module's settings from the app's registered config (`registerSoftureConfig`).
import { getModule, type SoftureConfig } from "@softure-ai/core";
import { getSoftureConfig } from "@softure-ai/core/next";
import { MODULE_ID } from "../index.js";
import type { SeoOptions } from "../options.js";
import { buildCanonicalUrl, resolveSeoSettings, type SeoRoutes, type SeoSettings } from "../settings.js";

/**
 * The seo settings of the app: the site origin, the canonical rule, robots, crawlers, sitemap and
 * IndexNow. Pass `config` outside a request (a CLI that loads `softure.config.ts` itself).
 */
export function getSeoSettings(config: SoftureConfig = getSoftureConfig()): SeoSettings {
  const module = getModule(config, MODULE_ID);
  if (module === undefined) {
    throw new Error("@softure-ai/seo: the seo module is not enabled; add seo() to modules in softure.config.ts");
  }
  return resolveSeoSettings(module.options as SeoOptions, {
    appOrigin: config.appOrigin,
    routes: module.routes as unknown as SeoRoutes,
  });
}

/**
 * The canonical URL of a page, for `metadata.alternates.canonical`:
 * `alternates: { canonical: getCanonicalUrl("/pricing") }`.
 */
export function getCanonicalUrl(path: string): string {
  return buildCanonicalUrl(path, getSeoSettings());
}

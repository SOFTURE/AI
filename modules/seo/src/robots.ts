// robots.txt as Next's `MetadataRoute.Robots` (a structural copy, so this file needs no `next`).
//
// Two rules FIRE_TRACKER paid for, kept here and guarded by literal tests:
// - `Allow: /` next to `Disallow: /` opens every path: both rules are equally long and RFC 9309
//   §2.2.2 breaks the tie in favour of allow. The root alone is `/$` (§2.2.3, `$` ends the match).
// - A crawler that finds a group with its own name ignores the `*` group (§2.2.1), so every named
//   group repeats the full allow and disallow. Without the disallow, naming GPTBot would open the
//   private paths to it.
import { AI_ON_DEMAND_FETCHERS, AI_SEARCH_CRAWLERS, AI_TRAINING_CRAWLERS } from "./crawlers.js";
import type { SeoSettings } from "./settings.js";

export interface RobotsRule {
  readonly userAgent: string | string[];
  readonly allow?: string | string[];
  readonly disallow?: string | string[];
}

export interface Robots {
  readonly rules: RobotsRule[];
  readonly sitemap: string;
}

const ROOT = "/";
const ROOT_ONLY = "/$";

/**
 * The robots.txt of the site: a `*` group, one group naming every crawler of the enabled
 * categories with the same rules, and one group closing the site to the crawlers of switched-off
 * categories (left out, they would fall under `*` and be let in).
 */
export function buildRobots(settings: Pick<SeoSettings, "robots" | "crawlers" | "siteOrigin" | "routes">): Robots {
  const { allow, disallow } = settings.robots;
  const isRootClosed = disallow.includes(ROOT);
  const rules = {
    allow: allow.map((path) => (path === ROOT && isRootClosed ? ROOT_ONLY : path)),
    disallow: [...disallow],
  };

  const categories = [
    { settings: settings.crawlers.search, crawlers: AI_SEARCH_CRAWLERS },
    { settings: settings.crawlers.onDemand, crawlers: AI_ON_DEMAND_FETCHERS },
    { settings: settings.crawlers.training, crawlers: AI_TRAINING_CRAWLERS },
  ];
  const listOf = (enabled: boolean) =>
    unique(categories.filter((category) => category.settings.enabled === enabled).flatMap((category) => [...category.crawlers, ...category.settings.extra]));
  const allowed = listOf(true);
  const blocked = listOf(false).filter((crawler) => !allowed.includes(crawler));

  return {
    rules: [
      { userAgent: "*", ...rules },
      ...(allowed.length > 0 ? [{ userAgent: allowed, ...rules }] : []),
      ...(blocked.length > 0 ? [{ userAgent: blocked, disallow: [ROOT] }] : []),
    ],
    sitemap: new URL(settings.routes.sitemap, settings.siteOrigin).toString(),
  };
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

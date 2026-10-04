// sitemap.xml as Next's `MetadataRoute.Sitemap` (a structural copy, so this file needs no `next`).
//
// `lastModified` is passed through only when the app or a contributor knows it. A date made up at
// build or request time changes without the content changing, which is a false signal, so an entry
// without one has no <lastmod> at all.
import { errorLogLabel } from "@softure-ai/core";
import { buildCanonicalUrl, type SeoSettings } from "./settings.js";

export interface SitemapEntry {
  /** A path on the site, e.g. `/pricing`; made absolute on the site origin. */
  readonly path: string;
  readonly lastModified?: Date;
  readonly changeFrequency?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  readonly priority?: number;
}

/** What a contributor gets: the resolved site origin, e.g. to skip pages of another host. */
export interface SitemapContributorContext {
  readonly siteOrigin: string;
}

/** Lists pages at request time, e.g. a blog's published articles (BL-5). */
export type SitemapContributor = (
  context: SitemapContributorContext,
) => readonly SitemapEntry[] | Promise<readonly SitemapEntry[]>;

export interface SitemapUrl {
  readonly url: string;
  readonly lastModified?: Date;
  readonly changeFrequency?: SitemapEntry["changeFrequency"];
  readonly priority?: number;
}

export interface BuildSitemapOptions {
  /** Where a failing contributor is reported; `console.error` by default. */
  readonly log?: (message: string) => void;
}

/**
 * The site's entries: the app's own first, then each contributor's in order. A contributor that
 * throws or rejects is logged and skipped: the sitemap is the address search engines read most,
 * and the rest of it must not turn into a 500. A URL listed twice keeps its first entry.
 */
export async function buildSitemap(
  settings: Pick<SeoSettings, "siteOrigin" | "trailingSlash" | "sitemap">,
  { log = console.error }: BuildSitemapOptions = {},
): Promise<SitemapUrl[]> {
  const context: SitemapContributorContext = { siteOrigin: settings.siteOrigin };
  const results = await Promise.allSettled(
    settings.sitemap.contributors.map(async (contributor) => {
      // Typed, but written by the app: checked at run time like any outside input.
      const entries: unknown = await contributor(context);
      if (!Array.isArray(entries)) {
        throw new TypeError("a sitemap contributor must return an array of entries");
      }
      return entries as readonly SitemapEntry[];
    }),
  );
  // Reported in the contributors' order, not in the order they settled.
  const lists = results.map((result, index): readonly SitemapEntry[] => {
    if (result.status === "fulfilled") {
      return result.value;
    }
    log(`sitemap: contributor ${String(index)} failed, its entries are left out: ${errorLogLabel(result.reason)}`);
    return [];
  });

  const byUrl = new Map<string, SitemapUrl>();
  for (const entry of [...settings.sitemap.entries, ...lists.flat()]) {
    // The app's entries are validated at startup; a contributor's are not, so a bad path is
    // reported and skipped instead of failing the whole sitemap.
    const path: unknown = entry.path;
    if (!isSitePath(path)) {
      log(`sitemap: entry "${String(path)}" is not a path on the site and is left out`);
      continue;
    }
    const url = buildCanonicalUrl(entry.path, settings);
    if (!byUrl.has(url)) {
      byUrl.set(url, toSitemapUrl(url, entry));
    }
  }
  return [...byUrl.values()];
}

function isSitePath(path: unknown): path is string {
  return typeof path === "string" && path.startsWith("/") && !path.startsWith("//");
}

function toSitemapUrl(url: string, entry: SitemapEntry): SitemapUrl {
  return {
    url,
    ...(entry.lastModified === undefined ? {} : { lastModified: entry.lastModified }),
    ...(entry.changeFrequency === undefined ? {} : { changeFrequency: entry.changeFrequency }),
    ...(entry.priority === undefined ? {} : { priority: entry.priority }),
  };
}

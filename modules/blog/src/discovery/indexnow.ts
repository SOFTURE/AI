// The addresses a publish run changed, for IndexNow (FIRE_TRACKER `src/lib/indexnow.ts`).
import type { PublishedChange } from "../db/publish-run.js";
import { getTextPath, type BlogRoutes } from "../pages/paths.js";

export type IndexNowChange = Pick<PublishedChange, "kind" | "action" | "statusBefore" | "statusAfter" | "slug" | "previousSlug">;

/**
 * The paths whose answer changed: a text public before or after (a withdrawn one answers 410 now, and
 * search engines should learn it), its old slug when it was public (now a 301), and the hub of its
 * kind (the listing for an article, the glossary for a term). A draft that stayed a draft and an
 * unchanged text add nothing. Texts first, then hubs, without repeats.
 */
export function getIndexNowPaths(changes: readonly IndexNowChange[], routes: BlogRoutes): string[] {
  const texts = new Set<string>();
  const hubs = new Set<string>();
  for (const change of changes) {
    const wasPublic = change.statusBefore === "published";
    const isPublic = change.statusAfter === "published";
    if (change.action === "unchanged" || (!wasPublic && !isPublic)) continue;
    texts.add(getTextPath(routes, change.kind, change.slug));
    if (change.previousSlug !== null && wasPublic) texts.add(getTextPath(routes, change.kind, change.previousSlug));
    hubs.add(change.kind === "term" ? routes.glossary : routes.index);
  }
  return [...texts, ...hubs];
}

// "Read next" under an article (FIRE_TRACKER `src/lib/blog-discovery.ts`), chosen without manual lists.
import type { BlogArticle } from "../contract.js";

export type RelatedCandidate = Pick<BlogArticle, "id" | "cluster" | "isPillar">;

/** How many texts "read next" shows under an article. */
export const RELATED_LIMIT = 4;

/** At most this many satellites under a pillar: its whole cluster, but a longer list is a listing. */
export const PILLAR_RELATED_LIMIT = 6;

/** Pillars first, then the input order (newest first). */
function pillarsFirst<T extends RelatedCandidate>(texts: readonly T[]): T[] {
  return [...texts.filter((text) => text.isPillar), ...texts.filter((text) => !text.isPillar)];
}

/**
 * - **A satellite:** the pillar of its cluster, the rest of the cluster, then pillars and texts of
 *   other clusters; {@link RELATED_LIMIT} in total.
 * - **A pillar:** every satellite of its cluster (up to {@link PILLAR_RELATED_LIMIT}), filled up to
 *   {@link RELATED_LIMIT} from other clusters.
 * - **No cluster:** pillars, then the newest.
 *
 * `published` comes newest first (the store's order); an article never recommends itself.
 */
export function getRelatedArticles<T extends RelatedCandidate>(article: RelatedCandidate, published: readonly T[]): T[] {
  const others = published.filter((candidate) => candidate.id !== article.id);
  const sameCluster = article.cluster === null ? [] : others.filter((candidate) => candidate.cluster === article.cluster);
  const rest = pillarsFirst(others.filter((candidate) => !sameCluster.includes(candidate)));
  if (article.isPillar) {
    const satellites = sameCluster.slice(0, PILLAR_RELATED_LIMIT);
    return [...satellites, ...rest].slice(0, Math.max(satellites.length, RELATED_LIMIT));
  }
  return [...pillarsFirst(sameCluster), ...rest].slice(0, RELATED_LIMIT);
}

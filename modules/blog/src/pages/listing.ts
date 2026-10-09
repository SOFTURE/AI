// How the listing and the glossary order texts, and the breadcrumbs of a text: pure functions over
// stored rows, so the pages only render what these return.
import type { Locale } from "@softure-ai/core";
import type { BlogArticle } from "../contract.js";
import type { LocalizedText } from "../options.js";
import { getArticlePath, getTermPath, type BlogRoutes } from "./paths.js";

export interface ClusterGroup<T> {
  /** `null`: the texts without a cluster. */
  readonly cluster: string | null;
  readonly label: string;
  /** The cluster's pillar, shown before the other cards; `null` without one. */
  readonly lead: T | null;
  /** The other texts, in the order they came in (newest first from `listArticles`). */
  readonly rest: readonly T[];
}

/** The display name of a cluster: the app's label in the locale, else the key with spaces and a capital. */
export function getClusterLabel(cluster: string, labels: Readonly<Record<string, LocalizedText>>, locale: Locale): string {
  const label = labels[cluster];
  if (label !== undefined) return label[locale] ?? label.en;
  const words = cluster.replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The cluster anchor prefix when the app sets none (`blog({ anchors: { cluster } })`). */
export const DEFAULT_CLUSTER_ANCHOR_PREFIX = "cluster";

/** The anchor of a cluster's section on the listing (`<prefix>-<cluster>`): the target of the article's middle crumb. */
export function getClusterAnchor(cluster: string, prefix: string = DEFAULT_CLUSTER_ANCHOR_PREFIX): string {
  return `${prefix}-${cluster}`;
}

/** The pillar leads its group; the rest keep their order. Without a pillar there is no lead. */
export function splitClusterLead<T extends Pick<BlogArticle, "isPillar">>(articles: readonly T[]): { lead: T | null; rest: T[] } {
  const lead = articles.find((article) => article.isPillar) ?? null;
  return { lead, rest: articles.filter((article) => article !== lead) };
}

/**
 * Articles in groups by cluster. A group's place comes from its newest text (a fresh topic on top);
 * texts without a cluster always come last, under `otherLabel`.
 */
export function groupByCluster<T extends Pick<BlogArticle, "cluster" | "isPillar">>(
  articles: readonly T[],
  getLabel: (cluster: string) => string,
  otherLabel: string,
): ClusterGroup<T>[] {
  const groups = new Map<string | null, T[]>();
  for (const article of articles) {
    const list = groups.get(article.cluster) ?? [];
    list.push(article);
    groups.set(article.cluster, list);
  }
  const named = [...groups.entries()]
    .filter((entry): entry is [string, T[]] => entry[0] !== null)
    .map(([cluster, list]) => ({ cluster, label: getLabel(cluster), ...splitClusterLead(list) }));
  const rest = groups.get(null);
  return rest === undefined ? named : [...named, { cluster: null, label: otherLabel, ...splitClusterLead(rest) }];
}

export interface FeaturedArticlesOptions {
  /** At most this many articles; a whole number from 0 up. */
  readonly limit: number;
}

/**
 * Featured articles (issue #318): the pillars first, then the rest, each part in the order it came in
 * (newest first from `listArticles`), at most `limit`. A bad `limit` is a bug of the caller: `RangeError`.
 */
export function selectFeaturedArticles<T extends Pick<BlogArticle, "isPillar">>(articles: readonly T[], options: FeaturedArticlesOptions): T[] {
  if (!Number.isInteger(options.limit) || options.limit < 0) throw new RangeError(`selectFeaturedArticles: limit must be a whole number from 0 up, not ${String(options.limit)}`);
  return [...articles.filter((article) => article.isPillar), ...articles.filter((article) => !article.isPillar)].slice(0, options.limit);
}

/** Terms in the locale's alphabetical order (a letter with a diacritic right after its base letter, not after Z). */
export function sortTerms<T extends Pick<BlogArticle, "title">>(terms: readonly T[], locale: Locale): T[] {
  return [...terms].sort((a, b) => a.title.localeCompare(b.title, locale));
}

export interface Crumb {
  readonly name: string;
  /** The path on the site; the last crumb (the page itself) has one too, as JSON-LD needs it. */
  readonly path: string;
}

export interface CrumbLabels {
  /** The listing's name. */
  readonly blog: string;
  /** The glossary's name. */
  readonly glossary: string;
  readonly cluster: (cluster: string) => string;
}

export interface ArticleCrumbOptions {
  /** The listing's cluster anchor prefix; `cluster` when left out. */
  readonly clusterAnchorPrefix?: string;
}

/** Blog › cluster › title; without a cluster, Blog › title. */
export function getArticleCrumbs(
  article: Pick<BlogArticle, "slug" | "title" | "cluster">,
  routes: BlogRoutes,
  labels: CrumbLabels,
  options: ArticleCrumbOptions = {},
): Crumb[] {
  const crumbs: Crumb[] = [{ name: labels.blog, path: routes.index }];
  if (article.cluster !== null) {
    crumbs.push({ name: labels.cluster(article.cluster), path: `${routes.index}#${getClusterAnchor(article.cluster, options.clusterAnchorPrefix)}` });
  }
  crumbs.push({ name: article.title, path: getArticlePath(routes, article.slug) });
  return crumbs;
}

/** Blog › glossary › term. */
export function getTermCrumbs(term: Pick<BlogArticle, "slug" | "title">, routes: BlogRoutes, labels: CrumbLabels): Crumb[] {
  return [
    { name: labels.blog, path: routes.index },
    { name: labels.glossary, path: routes.glossary },
    { name: term.title, path: getTermPath(routes, term.slug) },
  ];
}

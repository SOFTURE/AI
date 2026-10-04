// Where the blog's pages live: the module's routes (`blog({ routes })`), the paths of articles and
// terms under them, the slugs the static pages take, and the reverse: which text a request path names.

export interface BlogRoutes {
  /** The listing; an article lives at `<index>/<slug>`. */
  readonly index: string;
  /** The glossary index; a term lives at `<glossary>/<slug>`. */
  readonly glossary: string;
  /** The "how our texts are made" page (only with `blog({ methodPage: true })`). */
  readonly method: string;
}

export type BlogPathKind = "article" | "term";

export interface BlogPathMatch {
  readonly kind: BlogPathKind;
  readonly slug: string;
}

/** A slug as the file parser accepts it: kebab-case, at most 100 characters. */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_SLUG_LENGTH = 100;

/** A route without its trailing slashes (the root stays `/`). A loop, not `/\/+$/`: linear on any input. */
export function normalizeRoute(path: string): string {
  let end = path.length;
  while (end > 1 && path[end - 1] === "/") end -= 1;
  return path.slice(0, end);
}

function joinPath(base: string, segment: string): string {
  return base === "/" ? `/${segment}` : `${base}/${segment}`;
}

export function getArticlePath(routes: BlogRoutes, slug: string): string {
  return joinPath(routes.index, slug);
}

export function getTermPath(routes: BlogRoutes, slug: string): string {
  return joinPath(routes.glossary, slug);
}

/** The path of a text by its kind. */
export function getTextPath(routes: BlogRoutes, kind: BlogPathKind, slug: string): string {
  return kind === "term" ? getTermPath(routes, slug) : getArticlePath(routes, slug);
}

/** The one segment `path` adds under `base`, or `null` when it is not exactly one segment deeper. */
function getChildSegment(base: string, path: string): string | null {
  const prefix = base === "/" ? "/" : `${base}/`;
  if (!path.startsWith(prefix)) return null;
  const rest = path.slice(prefix.length);
  return rest === "" || rest.includes("/") ? null : rest;
}

/**
 * Slugs an article cannot take: a static page one segment under the listing (the glossary index,
 * the method page when the app mounts it) wins over the article route, so such an article would be
 * unreachable. Merged with the app's own `reservedSlugs`, without repeats.
 */
export function getReservedSlugs(routes: BlogRoutes, options: { readonly methodPage: boolean; readonly reservedSlugs: readonly string[] }): string[] {
  const pages = options.methodPage ? [routes.glossary, routes.method] : [routes.glossary];
  const derived = pages.map((path) => getChildSegment(routes.index, path)).filter((segment): segment is string => segment !== null);
  return [...new Set([...options.reservedSlugs, ...derived])];
}

function isSlug(segment: string): boolean {
  return segment.length <= MAX_SLUG_LENGTH && SLUG.test(segment);
}

/**
 * The text a request path names: exactly `<index>/<slug>` or `<glossary>/<slug>` with a slug the
 * parser could have accepted, and not a reserved slug. Anything else (the listing, a deeper path such
 * as an OG image, upper case, a static page) is `null`, so it never costs a database query.
 */
export function matchBlogPath(pathname: string, routes: BlogRoutes, reservedSlugs: readonly string[]): BlogPathMatch | null {
  const termSlug = getChildSegment(routes.glossary, pathname);
  if (termSlug !== null && isSlug(termSlug)) return { kind: "term", slug: termSlug };
  const articleSlug = getChildSegment(routes.index, pathname);
  if (articleSlug !== null && isSlug(articleSlug) && !reservedSlugs.includes(articleSlug)) return { kind: "article", slug: articleSlug };
  return null;
}

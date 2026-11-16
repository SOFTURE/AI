// The `ignorePaths` rule shared by the Node sampler and the Workers handler: an entry matches its own path and every
// path below it as whole segments; it reaches no Node-only package, so the Workers entry may import it.
import { getPath } from "./node/stable-http-attributes.js";

/**
 * Whether a request target (a path with its query, or a full URL) is one of `paths` or below one: `/api/health`
 * matches `/api/health/live`, not `/api/healthz`; the query string is ignored. Throws when an entry does not start
 * with `/`.
 */
export function createIgnoredPathMatcher(paths: readonly string[]): (target: string) => boolean {
  const prefixes = normalizeIgnoredPaths(paths);
  return (target) => isIgnoredPath(getPath(target), prefixes);
}

/** The entries trimmed and without trailing slashes. Throws when an entry does not start with `/`. */
export function normalizeIgnoredPaths(paths: readonly string[]): string[] {
  return paths.map((path, index) => normalizePath(path, index));
}

/** Whether `path` is one of the normalized `prefixes` or below one; `null` (no path) never is. */
export function isIgnoredPath(path: string | null, prefixes: readonly string[]): boolean {
  if (path === null) {
    return false;
  }
  return prefixes.some((prefix) => prefix === "/" || path === prefix || path.startsWith(`${prefix}/`));
}

function normalizePath(path: string, index: number): string {
  const trimmed = path.trim();
  if (!trimmed.startsWith("/")) {
    throw new Error(`observability: traces.ignorePaths[${String(index)}] must be a path starting with /`);
  }
  // `/api/health/` and `/api/health` mean the same subtree; `/` alone keeps its slash and ignores every path.
  return trimmed.length > 1 ? dropTrailingSlashes(trimmed) : trimmed;
}

// A loop, not `/\/+$/`: that regular expression backtracks polynomially on a run of slashes.
function dropTrailingSlashes(path: string): string {
  let end = path.length;
  while (end > 1 && path[end - 1] === "/") {
    end -= 1;
  }
  return path.slice(0, end);
}

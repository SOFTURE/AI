// 301 and 410 for the addresses of texts, decided without Next and without a database.
//
// ## Why before the page
//
// `next/navigation` has no 410 and `permanentRedirect` answers 308. A withdrawn text answers 410 Gone
// (search engines drop it faster than a 404) and an old slug a 301 straight to the current address.
// A status other than 200, 404 or a redirect can only be set before the page, in the app's proxy,
// which runs on Node.js since Next 16 and may query the database. The lookup is injected, so this
// file is tested without one and the proxy piece (`@softure-ai/blog/proxy`) adds the cache.
import type { BlogArticleKind, BlogArticleStatus } from "../contract.js";
import { getTextPath, type BlogPathMatch, type BlogRoutes } from "./paths.js";

export type BlogPathDecision =
  | { readonly kind: "pass" }
  | { readonly kind: "redirect"; readonly path: string }
  | { readonly kind: "gone" };

export interface BlogPathLookup {
  /** The row under its current slug, in any status; `null` when there is none. */
  readonly findText: (slug: string) => Promise<{ readonly status: BlogArticleStatus; readonly kind: BlogArticleKind } | null>;
  /** The current slug of the text that once had `oldSlug`: the target of a 301. */
  readonly findRedirect: (oldSlug: string) => Promise<string | null>;
}

const PASS: BlogPathDecision = { kind: "pass" };

/**
 * - A current row wins over the history: a slug back in use is the address of a text again.
 * - A withdrawn text under the path of its own kind → 410.
 * - A published text under the other kind's path (a term at the article path) → 301 to its own path.
 * - An old slug → 301 to the current path of its text (which may answer 410 itself).
 * - Everything else (unknown, draft) passes on: the page answers 404.
 */
export async function decideBlogPath(match: BlogPathMatch, routes: BlogRoutes, lookup: BlogPathLookup): Promise<BlogPathDecision> {
  const text = await lookup.findText(match.slug);
  if (text !== null) {
    if (text.kind === match.kind) return text.status === "withdrawn" ? { kind: "gone" } : PASS;
    return text.status === "published" ? { kind: "redirect", path: getTextPath(routes, text.kind, match.slug) } : PASS;
  }
  const target = await lookup.findRedirect(match.slug);
  if (target === null || target === match.slug) return PASS;
  const current = await lookup.findText(target);
  return current === null ? PASS : { kind: "redirect", path: getTextPath(routes, current.kind, target) };
}

export interface CachedDeciderOptions {
  /** How long a decision holds; an urgent fix through the CLI shows up at the latest after this. Default 60 s. */
  readonly ttlMs?: number;
  /** The most decisions kept; paths a scanner makes up cannot grow the memory. Default 500. */
  readonly maxEntries?: number;
  readonly now?: () => number;
  /** Where a failed lookup is reported; `console.error` by default. */
  readonly onError?: (message: string) => void;
}

/**
 * Decisions with a memory: the proxy runs on every request and the pages are cached (ISR), so
 * without one every cached view would cost a query. A failed lookup is not remembered and passes the
 * request on: the page answers by itself, and a database outage never turns the blog into a 500.
 */
export function createCachedBlogPathDecider(
  routes: BlogRoutes,
  lookup: BlogPathLookup,
  { ttlMs = 60_000, maxEntries = 500, now = Date.now, onError = (message) => console.error(message) }: CachedDeciderOptions = {},
): (match: BlogPathMatch) => Promise<BlogPathDecision> {
  const cache = new Map<string, { readonly decision: BlogPathDecision; readonly expiresAt: number }>();
  return async (match) => {
    const key = `${match.kind}:${match.slug}`;
    const cached = cache.get(key);
    if (cached !== undefined && cached.expiresAt > now()) return cached.decision;
    let decision: BlogPathDecision;
    try {
      decision = await decideBlogPath(match, routes, lookup);
    } catch (error) {
      onError(`@softure-ai/blog proxy: lookup of the ${match.kind} "${match.slug}" failed: ${error instanceof Error ? error.message : String(error)}`);
      return PASS;
    }
    cache.delete(key);
    if (cache.size >= maxEntries) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    cache.set(key, { decision, expiresAt: now() + ttlMs });
    return decision;
  };
}

export interface GonePageCopy {
  readonly title: string;
  readonly heading: string;
  readonly body: string;
  readonly link: string;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * The body of a 410: a short page with the way on. No React (the proxy renders no components), no
 * script, no external resource; `noindex`. Every value is escaped: copy comes from the app's overrides.
 */
export function buildGonePage(copy: GonePageCopy, options: { readonly lang: string; readonly indexPath: string }): string {
  return [
    "<!doctype html>",
    `<html lang="${escapeHtml(options.lang)}">`,
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="robots" content="noindex">',
    `<title>${escapeHtml(copy.title)}</title>`,
    "</head>",
    '<body style="font-family:system-ui,sans-serif;max-width:40rem;margin:4rem auto;padding:0 1rem;line-height:1.5">',
    `<h1>${escapeHtml(copy.heading)}</h1>`,
    `<p>${escapeHtml(copy.body)} <a href="${escapeHtml(options.indexPath)}">${escapeHtml(copy.link)}</a></p>`,
    "</body>",
    "</html>",
    "",
  ].join("\n");
}

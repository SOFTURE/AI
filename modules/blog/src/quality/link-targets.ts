// Internal link targets from the file system (FIRE_TRACKER `src/lib/blog/quality/link-targets.ts`),
// for `softure-blog check`. A route exists when the Next.js app folder has a `page.*` or `route.*` for
// it (route groups vanish from the path; private segments and `_folders` are skipped). An article or
// a glossary term exists when the content folder has its published file of that kind, under
// `QualitySettings.paths` (the blog's routes unless `quality.paths` overrides them); a static page
// under the same path wins over the dynamic article route.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArticleFile, type ParseArticleFileOptions } from "../content/article-file.js";
import type { BlogArticleKind } from "../contract.js";
import type { GlossaryTerm } from "../render/glossary.js";
import type { InternalLinkResolver } from "./rules/links.js";

const ROUTE_FILES = /^(?:page|route)\.(?:tsx?|jsx?|mdx?)$/;

export interface AppRoute {
  readonly pattern: RegExp;
  /** Has a `[param]` segment. */
  readonly isDynamic: boolean;
}

export interface InternalLinkResolverOptions {
  /** The Next.js app folder, or `null` when the app has none (only content links resolve). */
  readonly appDir: string | null;
  readonly privateRouteSegments: readonly string[];
  readonly paths: { readonly articles: string; readonly terms: string };
  /** Published texts by slug. */
  readonly content: ReadonlyMap<string, BlogArticleKind>;
}

/** The app folder to read: the given one, else `src/app`, else `app`, else none. */
export function findAppDir(cwd: string, appDir: string | undefined): string | null {
  if (appDir !== undefined) return join(cwd, appDir);
  return [join(cwd, "src/app"), join(cwd, "app")].find((dir) => existsSync(dir)) ?? null;
}

export function collectAppRoutes(appDir: string, privateSegments: readonly string[]): AppRoute[] {
  const routes: AppRoute[] = [];
  const walk = (dir: string, segments: readonly string[]): void => {
    const entries = readdirSync(dir, { withFileTypes: true });
    if (entries.some((entry) => entry.isFile() && ROUTE_FILES.test(entry.name))) {
      const visible = segments.filter((segment) => !/^\(.*\)$/.test(segment));
      const pattern = visible.map((segment) => (/^\[.*\]$/.test(segment) ? "[^/]+" : escapeRegExp(segment))).join("/");
      routes.push({ pattern: new RegExp(`^/${pattern}$`), isDynamic: visible.some((segment) => /^\[.*\]$/.test(segment)) });
    }
    for (const entry of entries) {
      if (entry.isDirectory() && !privateSegments.includes(entry.name) && !entry.name.startsWith("_")) walk(join(dir, entry.name), [...segments, entry.name]);
    }
  };
  walk(appDir, []);
  return routes;
}

/** Published texts in the content folders by slug: the file name is the slug (BL-2), the kind and status come from the frontmatter. */
export function readPublishedContent(files: readonly { readonly name: string; readonly text: string }[]): Map<string, BlogArticleKind> {
  const content = new Map<string, BlogArticleKind>();
  for (const file of files) {
    const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(file.text)?.[1] ?? "";
    if (!/^status:\s*(["']?)published\1\s*(?:#.*)?$/m.test(frontmatter)) continue;
    content.set(file.name.replace(/\.md$/, ""), /^kind:\s*(["']?)term\1\s*(?:#.*)?$/m.test(frontmatter) ? "term" : "article");
  }
  return content;
}

/**
 * The published glossary terms of the content folders, for the form conflict check: a later file
 * with the same slug replaces an earlier one (a checked file over its copy in the folder). A file that
 * does not parse is skipped; its own check reports it.
 */
export function readGlossaryTerms(files: readonly { readonly name: string; readonly text: string }[], parse: ParseArticleFileOptions = {}): GlossaryTerm[] {
  const terms = new Map<string, GlossaryTerm>();
  for (const file of files) {
    const parsed = parseArticleFile(file.text, file.name, parse);
    if (!parsed.ok) continue;
    const { slug, kind, status, termForms } = parsed.article;
    if (kind === "term" && status === "published") terms.set(slug, { slug, forms: termForms });
    else terms.delete(slug);
  }
  return [...terms.values()];
}

export function createInternalLinkResolver(options: InternalLinkResolverOptions): InternalLinkResolver {
  const routes = options.appDir === null || !existsSync(options.appDir) ? [] : collectAppRoutes(options.appDir, options.privateRouteSegments);
  const term = new RegExp(`^${escapeRegExp(options.paths.terms)}/([^/]+)$`);
  const article = new RegExp(`^${escapeRegExp(options.paths.articles === "/" ? "" : options.paths.articles)}/([^/]+)$`);
  const isStaticRoute = (pathname: string) => routes.some((route) => !route.isDynamic && route.pattern.test(pathname));
  return (rawPathname) => {
    const pathname = rawPathname.length > 1 ? rawPathname.replace(/\/$/, "") : rawPathname;
    const termSlug = term.exec(pathname)?.[1];
    if (termSlug !== undefined) return options.content.get(termSlug) === "term" || isStaticRoute(pathname);
    const articleSlug = article.exec(pathname)?.[1];
    if (articleSlug !== undefined) return options.content.get(articleSlug) === "article" || isStaticRoute(pathname);
    return routes.some((route) => route.pattern.test(pathname));
  };
}

/** Reads `*.md` files of a folder except README.md. */
export function readContentFolder(dir: string): { name: string; text: string }[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(".md") && name !== "README.md")
    .sort()
    .map((name) => ({ name, text: readFileSync(join(dir, name), "utf8") }));
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

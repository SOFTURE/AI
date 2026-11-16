import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { z } from "zod";
import { normalizePath } from "./findings.js";
import { matchesGlob } from "./ignore.js";
import { DEFAULT_REPORT_PATH } from "./report.js";

/** The part of a repository a run reports on: one folder, and the workspace package it holds when it is one. */
export interface Scope {
  /** The folder relative to the repository root, forward slashes, no trailing slash. */
  folder: string;
  /** The `name` of the folder's package.json when the folder is a workspace package, otherwise null. */
  packageName: string | null;
}

export type ScopeResult = { ok: true; scope: Scope } | { ok: false; error: string };

const manifestSchema = z.object({
  name: z.string().optional(),
  workspaces: z.union([z.array(z.string()), z.object({ packages: z.array(z.string()).default([]) })]).optional(),
});

function readManifest(path: string): z.infer<typeof manifestSchema> | null {
  if (!existsSync(path)) return null;
  try {
    const parsed = manifestSchema.safeParse(JSON.parse(readFileSync(path, "utf8")));
    return parsed.success ? parsed.data : null;
  } catch {
    // A manifest that is not JSON names no package and no workspaces; the caller reports the name as unknown.
    return null;
  }
}

function getWorkspacePatterns(repo: string): string[] {
  const workspaces = readManifest(join(repo, "package.json"))?.workspaces;
  if (workspaces === undefined) return [];
  return Array.isArray(workspaces) ? workspaces : workspaces.packages;
}

function isDirectory(path: string): boolean {
  return existsSync(path) && statSync(path).isDirectory();
}

/** The workspace package folders of a repository (relative paths), from the root package.json `workspaces`. */
export function listWorkspaceFolders(repo: string): string[] {
  const folders: string[] = [];
  for (const raw of getWorkspacePatterns(repo)) {
    const pattern = normalizePath(raw).replace(/\/+$/, "");
    if (pattern.startsWith("!")) continue;
    const wildcard = pattern.search(/[*?[{]/);
    if (wildcard === -1) {
      if (isDirectory(join(repo, pattern))) folders.push(pattern);
      continue;
    }
    const base = pattern.slice(0, pattern.lastIndexOf("/", wildcard) + 1).replace(/\/$/, "");
    if (!isDirectory(join(repo, base))) continue;
    for (const entry of readdirSync(join(repo, base), { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name === "node_modules") continue;
      const folder = base === "" ? entry.name : `${base}/${entry.name}`;
      if (matchesGlob(folder, pattern)) folders.push(folder);
    }
  }
  return [...new Set(folders)].sort();
}

function getPackageName(repo: string, folder: string): string | null {
  return readManifest(join(repo, folder, "package.json"))?.name ?? null;
}

function toInsideFolder(root: string, value: string): string | null {
  const target = resolve(root, value);
  if (!existsSync(target)) return null;
  const inside = relative(root, realpathSync(target));
  if (inside === "" || inside.startsWith("..") || isAbsolute(inside)) return null;
  return normalizePath(inside.split("\\").join("/"));
}

/**
 * Resolves a `scope` value before any model call: a folder relative to the repository root (it must exist, be a
 * folder and stay inside the repository after symlinks), or the name of a workspace package (resolved through the root
 * package.json `workspaces`). Anything else is an error that names what was tried.
 */
export function resolveScope(repo: string, value: string): ScopeResult {
  const root = realpathSync(repo);
  const wanted = value.trim();
  if (wanted === "") return { ok: false, error: "The scope is empty: pass a folder or a workspace package name" };
  const workspaceFolders = listWorkspaceFolders(root);
  const byName = workspaceFolders.find((folder) => getPackageName(root, folder) === wanted);
  if (byName !== undefined) return { ok: true, scope: { folder: byName, packageName: wanted } };
  if (wanted.startsWith("@") && !isDirectory(resolve(root, wanted))) {
    return {
      ok: false,
      error:
        workspaceFolders.length === 0
          ? `The scope ${wanted} is not a folder, and the repository has no workspaces to resolve a package name through`
          : `The scope ${wanted} is neither a folder nor a workspace package of this repository`,
    };
  }
  if (isAbsolute(wanted)) return { ok: false, error: `The scope ${wanted} must be a folder relative to the repository root` };
  const target = resolve(root, wanted);
  if (!existsSync(target)) return { ok: false, error: `The scope ${wanted} is neither a folder nor a workspace package of this repository` };
  const folder = toInsideFolder(root, wanted);
  if (folder === null) return { ok: false, error: `The scope ${wanted} is outside the repository (or is its root: leave the scope out for that)` };
  if (!statSync(realpathSync(target)).isDirectory()) return { ok: false, error: `The scope ${wanted} is a file, not a folder` };
  return { ok: true, scope: { folder, packageName: workspaceFolders.includes(folder) ? getPackageName(root, folder) : null } };
}

/** Whether a repository-relative file is inside the scope folder. */
export function isInScope(file: string, scope: Scope): boolean {
  const path = normalizePath(file);
  return path === scope.folder || path.startsWith(`${scope.folder}/`);
}

/** Whether a repository-relative file matches one of the `paths` globs (any file when there are none). */
export function isInPaths(file: string, paths: string[]): boolean {
  return paths.length === 0 || paths.some((glob) => matchesGlob(file, glob));
}

/** Splits `paths` values given as repeated flags, commas, spaces or new lines into a clean glob list. */
export function parsePaths(values: string[]): string[] {
  return [...new Set(values.flatMap((value) => value.split(/[\s,]+/)).map((glob) => normalizePath(glob)).filter((glob) => glob !== ""))];
}

/** Why a `paths` glob is refused (absolute, or reaching outside the repository), or null. */
export function getPathsProblem(paths: string[]): string | null {
  const bad = paths.find((glob) => isAbsolute(glob) || glob.split("/").includes(".."));
  return bad === undefined ? null : `The paths glob ${bad} must be relative to the repository root and stay inside it`;
}

/** A branch-safe slug of the scope folder: `modules/mcp-access` → `modules-mcp-access`. */
export function getScopeSlug(scope: Scope): string {
  return scope.folder
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Where the report goes by default: the root report, or the scope's own, so reports of different scopes never collide. */
export function getDefaultReportPath(scope: Scope | null): string {
  return scope === null ? DEFAULT_REPORT_PATH : `${scope.folder}/${DEFAULT_REPORT_PATH}`;
}

/** The longest text taken from one context file; the rest is left for the agent to read. */
export const CONTEXT_FILE_LIMIT = 12_000;

const CONTEXT_FILES = ["README.md", "package.json", "CHANGELOG.md"] as const;

function readLimited(path: string): string {
  const text = readFileSync(path, "utf8");
  return text.length <= CONTEXT_FILE_LIMIT ? text : `${text.slice(0, CONTEXT_FILE_LIMIT)}\n[… cut at ${String(CONTEXT_FILE_LIMIT)} characters; read the file for the rest]`;
}

/** One file of the scope's local context, as the task quotes it. */
export interface ContextFile {
  path: string;
  text: string;
}

/** The AGENTS.md files on the path below the root down to the scope (the root one the agent reads itself). */
function getAgentsFiles(root: string, scope: Scope): string[] {
  const segments = scope.folder.split("/");
  const files: string[] = [];
  for (let index = 1; index <= segments.length; index++) {
    const path = `${segments.slice(0, index).join("/")}/AGENTS.md`;
    if (existsSync(join(root, path))) files.push(path);
  }
  return files;
}

/** The test folders and files directly in the scope, named so the agent knows where its tests are. */
export function getScopeTests(repo: string, scope: Scope): string[] {
  const dir = join(repo, scope.folder);
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => /^(tests?|__tests__|e2e|spec)$/.test(entry.name) || /\.(test|spec)\.[cm]?[jt]sx?$/.test(entry.name))
    .map((entry) => `${scope.folder}/${entry.name}${entry.isDirectory() ? "/" : ""}`)
    .sort();
}

/** The scope's local context: AGENTS.md files on its path, then its README, package.json and CHANGELOG. */
export function getScopeContext(repo: string, scope: Scope): ContextFile[] {
  const root = realpathSync(repo);
  const paths = [...getAgentsFiles(root, scope), ...CONTEXT_FILES.map((name) => `${scope.folder}/${name}`)];
  return paths.filter((path) => existsSync(join(root, path)) && statSync(join(root, path)).isFile()).map((path) => ({ path, text: readLimited(join(root, path)) }));
}

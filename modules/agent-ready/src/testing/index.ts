// Guards an app runs in its own tests, so the discovery documents stay true as the app changes: every URL they name
// is a route the app has, digests match the bytes, cards list the server's tools, no account data leaks into a
// public document, and every URL is on a host the app owns. Runner-agnostic: each guard throws an `Error` that lists
// every problem, so it works under any test runner.
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { digestOf, type AgentSkillsIndex } from "../agent-skills.js";
import type { McpServerDescription } from "../mcp-description.js";

const ROUTE_FILES = ["route.ts", "route.js", "route.tsx", "route.jsx", "page.tsx", "page.ts", "page.jsx", "page.js", "page.mdx"];

function hasRouteFile(dir: string): boolean {
  return ROUTE_FILES.some((file) => existsSync(join(dir, file)));
}

function listDirs(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((name) => statSync(join(dir, name)).isDirectory());
}

function isGroup(name: string): boolean {
  return /^\(.+\)$/.test(name);
}

function matchSegments(dir: string, segments: readonly string[]): string | null {
  const dirs = listDirs(dir);
  // Route groups and parallel slots add no segment.
  for (const name of dirs.filter((entry) => isGroup(entry) || entry.startsWith("@"))) {
    const found = matchSegments(join(dir, name), segments);
    if (found !== null) return found;
  }
  if (segments.length === 0) return hasRouteFile(dir) ? dir : (dirs.filter((name) => /^\[\[\.\.\..+\]\]$/.test(name)).map((name) => join(dir, name)).find(hasRouteFile) ?? null);
  const [head = "", ...rest] = segments;
  for (const name of dirs) {
    if (name === head || (/^\[[^.[\]]+\]$/.test(name) && !isGroup(name))) {
      const found = matchSegments(join(dir, name), rest);
      if (found !== null) return found;
    }
  }
  for (const name of dirs.filter((entry) => /^\[\[?\.\.\..+\]\]?$/.test(entry))) {
    if (hasRouteFile(join(dir, name))) return join(dir, name);
  }
  return null;
}

/**
 * The folder of `app/` that answers `path`, or null: exact folders (dotted ones such as `openapi.json` included),
 * route groups `(x)`, parallel slots `@x`, dynamic `[x]` and catch-all `[...x]` / `[[...x]]` segments, ending in a
 * `route` or `page` file. A file-system check: it cannot see `rewrites` or a proxy.
 */
export function findAppRoute(appDir: string, path: string): string | null {
  const segments = new URL(path, "http://route.invalid").pathname
    .split("/")
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment));
  return matchSegments(appDir, segments);
}

/** Every http(s) URL string in a document, depth first. */
export function collectUrls(document: unknown): string[] {
  if (typeof document === "string") {
    return /^https?:\/\//.test(document) && URL.canParse(document) ? [document] : [];
  }
  if (Array.isArray(document)) return document.flatMap(collectUrls);
  if (typeof document === "object" && document !== null) return Object.values(document).flatMap(collectUrls);
  return [];
}

export interface CatalogTargetsInput {
  /** The app's `app/` folder. */
  readonly appDir: string;
  /** The documents whose URLs must be routes of the app (catalogs, cards, metadata). */
  readonly documents: readonly unknown[];
  /** The origins the app serves; URLs on other hosts are not checked. */
  readonly origins: readonly string[];
  /** Paths served outside `app/` (a proxy, `rewrites`, `public/`), accepted as they are. */
  readonly servedElsewhere?: readonly string[];
}

/** Throws unless every URL on the app's origins in `documents` has a route in `appDir`. */
export function expectCatalogTargetsExist(input: CatalogTargetsInput): void {
  const owned = new Set(input.origins.map((origin) => new URL(origin).origin));
  const elsewhere = new Set(input.servedElsewhere ?? []);
  const missing = new Set<string>();
  for (const url of input.documents.flatMap(collectUrls)) {
    const parsed = new URL(url);
    if (!owned.has(parsed.origin) || elsewhere.has(parsed.pathname)) continue;
    if (findAppRoute(input.appDir, parsed.pathname) === null) missing.add(url);
  }
  if (missing.size > 0) throw new Error(`agent-ready: documents name URLs the app has no route for:\n${[...missing].map((url) => `- ${url}`).join("\n")}`);
}

/** Throws unless each skill in `index` downloads (through `readSkill`) to the bytes its digest names. */
export async function expectSkillDigestsMatch(index: AgentSkillsIndex, readSkill: (url: string) => string | Promise<string>): Promise<void> {
  const problems: string[] = [];
  for (const skill of index.skills) {
    const digest = digestOf(await readSkill(skill.url));
    if (digest !== skill.digest) problems.push(`- ${skill.name}: index ${skill.digest}, file ${digest}`);
  }
  if (problems.length > 0) throw new Error(`agent-ready: skill digests do not match their files:\n${problems.join("\n")}`);
}

export interface ToolListingCard {
  /** The MCP server card's tools. */
  readonly tools?: ReadonlyArray<{ readonly name: string }>;
  /** The A2A card's skills. */
  readonly skills?: ReadonlyArray<{ readonly id: string }>;
}

/** Throws unless the card lists exactly the tools the server lists, no more and no fewer. */
export function expectCardToolsMatchServer(card: ToolListingCard, server: McpServerDescription): void {
  const listed = card.tools?.map((tool) => tool.name) ?? card.skills?.map((skill) => skill.id) ?? [];
  const expected = server.tools.map((tool) => tool.name);
  const extra = listed.filter((name) => !expected.includes(name));
  const absent = expected.filter((name) => !listed.includes(name));
  if (extra.length + absent.length > 0) {
    throw new Error(`agent-ready: the card and the server disagree: not on the server [${extra.join(", ")}], missing from the card [${absent.join(", ")}]`);
  }
}

const UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

export interface NoAccountDataOptions {
  /** UUIDs the document may hold (none by default: account ids are UUIDs, and public documents name none). */
  readonly allowedUuids?: readonly string[];
}

/**
 * Throws when a public document contains any of `values` (account ids, e-mail addresses, token prefixes) or, by
 * default, any UUID at all.
 */
export function expectNoAccountData(document: unknown, values: readonly string[], options: NoAccountDataOptions = {}): void {
  const text = typeof document === "string" ? document : JSON.stringify(document);
  const allowed = new Set((options.allowedUuids ?? []).map((uuid) => uuid.toLowerCase()));
  const uuids = (text.match(UUID_PATTERN) ?? []).filter((uuid) => !allowed.has(uuid.toLowerCase()));
  const found = [...values.filter((value) => value !== "" && text.includes(value)), ...new Set(uuids)];
  if (found.length > 0) throw new Error(`agent-ready: a public document contains account data: ${found.map((value) => JSON.stringify(value.slice(0, 40))).join(", ")}`);
}

export interface OriginMatrixInput {
  readonly appOrigin: string;
  readonly apexOrigin: string;
  /** Origins a document may name besides the app's own (spec schemas, a provider's site). */
  readonly external?: readonly string[];
}

/** Throws when `document` names a URL on a host that is neither the app, the apex nor an allowed external origin. */
export function expectOriginMatrix(document: unknown, input: OriginMatrixInput): void {
  const allowed = new Set([input.appOrigin, input.apexOrigin, ...(input.external ?? [])].map((origin) => new URL(origin).origin));
  const stray = [...new Set(collectUrls(document).filter((url) => !allowed.has(new URL(url).origin)))];
  if (stray.length > 0) throw new Error(`agent-ready: a document names hosts the app does not serve:\n${stray.map((url) => `- ${url}`).join("\n")}`);
}

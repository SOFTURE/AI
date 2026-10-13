// WebMCP: tools a public page offers an agent running in the browser (`document.modelContext.registerTool`). Browser
// only: no Node imports. The tools themselves are the app's; this entry gives their types, the result helpers, a
// registration that bridges both API generations, and an inline boot script for pages that ship no client component.

/** A tool result in the MCP shape: an object, not a string (scanners check it). */
export interface WebMcpToolResult {
  content: { type: "text"; text: string }[];
  isError?: boolean;
}

/**
 * A schema that converts itself to JSON Schema (Standard JSON Schema, `~standard.jsonSchema`), as zod 4 schemas do.
 * Typed by its shape, so this entry imports no library.
 */
export interface StandardJsonSchemaLike {
  readonly "~standard": {
    readonly jsonSchema: {
      readonly input: (options: { readonly target: "draft-2020-12" }) => Record<string, unknown>;
    };
  };
}

/** A tool's input: JSON Schema, or a zod schema converted to it (the input side, as the MCP SDK does). */
export type WebMcpInputSchema = Readonly<Record<string, unknown>> | StandardJsonSchemaLike;

/** A tool without `execute`: what a boot script or a component completes. */
export interface WebMcpToolDefinition {
  name: string;
  description: string;
  inputSchema: WebMcpInputSchema;
}

/** A tool as the app declares it. */
export interface WebMcpTool extends WebMcpToolDefinition {
  execute: (args: unknown) => Promise<WebMcpToolResult>;
}

/** A tool as `registerTool` takes it: the input schema is JSON Schema. */
export interface RegisteredWebMcpTool extends WebMcpTool {
  inputSchema: Record<string, unknown>;
}

/** The part of the WebMCP API used here. Newer browsers take `{ signal }`; older ones return `{ unregister() }`. */
export interface ModelContextLike {
  registerTool: (tool: RegisteredWebMcpTool, options?: { signal?: AbortSignal }) => unknown;
}

function isStandardJsonSchema(schema: WebMcpInputSchema): schema is StandardJsonSchemaLike {
  const standard = (schema as { "~standard"?: { jsonSchema?: { input?: unknown } } })["~standard"];
  return typeof standard?.jsonSchema?.input === "function";
}

/**
 * JSON Schema for a tool's input: a zod schema converted through its Standard JSON Schema interface (input side, so a
 * field with a default is optional; draft 2020-12) without `$schema`; JSON Schema as it is.
 */
export function toWebMcpInputSchema(schema: WebMcpInputSchema): Record<string, unknown> {
  if (!isStandardJsonSchema(schema)) return schema;
  const converted = schema["~standard"].jsonSchema.input({ target: "draft-2020-12" });
  delete converted.$schema;
  return converted;
}

export function textResult(text: string): WebMcpToolResult {
  return { content: [{ type: "text", text }] };
}

export function errorResult(text: string): WebMcpToolResult {
  return { content: [{ type: "text", text }], isError: true };
}

function isModelContext(value: unknown): value is ModelContextLike {
  return typeof value === "object" && value !== null && typeof (value as { registerTool?: unknown }).registerTool === "function";
}

/** `document.modelContext`, else `navigator.modelContext` (older Chrome), else null. */
export function findModelContext(): ModelContextLike | null {
  const fromDocument = typeof document === "undefined" ? undefined : (document as unknown as { modelContext?: unknown }).modelContext;
  if (isModelContext(fromDocument)) return fromDocument;
  const fromNavigator = typeof navigator === "undefined" ? undefined : (navigator as unknown as { modelContext?: unknown }).modelContext;
  return isModelContext(fromNavigator) ? fromNavigator : null;
}

/**
 * Registers `tool` until `signal` aborts: passes `{ signal }` (current API) and, when the browser returns a handle
 * with `unregister()` (older API), calls it on abort. A rejected registration is logged, never thrown.
 */
export function registerWebMcpTool(modelContext: ModelContextLike, tool: WebMcpTool, signal: AbortSignal): void {
  const warn = (error: unknown) => console.warn(`WebMCP: ${tool.name}: ${error instanceof Error ? error.message : String(error)}`);
  let handle: unknown;
  try {
    handle = modelContext.registerTool({ ...tool, inputSchema: toWebMcpInputSchema(tool.inputSchema) }, { signal });
  } catch (error) {
    warn(error);
    return;
  }
  const settle = (value: unknown) => {
    const unregister = (value as { unregister?: unknown } | null)?.unregister;
    if (typeof unregister !== "function") return;
    const call = () => {
      try {
        (unregister as () => void).call(value);
      } catch (error) {
        warn(error);
      }
    };
    if (signal.aborted) call();
    else signal.addEventListener("abort", call, { once: true });
  };
  if (handle instanceof Promise) handle.then(settle, warn);
  else settle(handle);
}

/** Drops a leading YAML frontmatter block. */
export function stripFrontmatter(text: string): string {
  return text.replace(/^---\n[\s\S]*?\n---\n+/, "");
}

/** The Markdown version of a public page: `Accept: text/markdown`, no cookies, the frontmatter stripped. */
export async function fetchMarkdown(path: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  const response = await fetchImpl(path, { headers: { Accept: "text/markdown" }, credentials: "omit" });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return stripFrontmatter(await response.text());
}

/** A tool of the boot script: its definition plus `execute` as JavaScript source. */
export interface WebMcpScriptTool extends WebMcpToolDefinition {
  /**
   * A function expression `(args, h) => Promise<result>`, as source text (wrapped in parentheses on lines of its own,
   * so a trailing `//` comment stays inside it). `h` holds `ok(text)`, `error(text)`,
   * `fetchMarkdown(path)` and `stripFrontmatter(text)`. It runs inline in `<head>`, so it cannot import anything.
   */
  execute: string;
}

export interface WebMcpBootScriptOptions {
  /** The `window` property that marks the tools as registered, e.g. `__exampleWebMcp`. */
  flag: string;
  /** Exact paths the tools register on (public pages only). */
  paths: readonly string[];
  /** Regular expression sources for more paths, e.g. `^/blog/[a-z0-9-]+$`. */
  pathPatterns?: readonly string[];
  tools: readonly WebMcpScriptTool[];
}

const FLAG_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/** JSON safe inside a `<script>`: `<` escaped, so the text holds no `</script` and no `<!--`. */
function toScriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

/**
 * An inline `<head>` script that registers `tools` on the listed paths: feature detection (`document.modelContext`,
 * then `navigator.modelContext`), the path allow-list, a `window[flag]` guard against a second registration, and
 * try/catch everywhere, so a failure never breaks the page. Throws when a tool's source could close the script tag.
 */
export function buildWebMcpBootScript(options: WebMcpBootScriptOptions): string {
  if (!FLAG_PATTERN.test(options.flag)) throw new Error(`WebMCP boot script: flag "${options.flag}" is not a JavaScript identifier`);
  for (const pattern of options.pathPatterns ?? []) new RegExp(pattern);
  const executes = options.tools.map((tool) => {
    if (/<\/script|<!--/i.test(tool.execute)) throw new Error(`WebMCP boot script: the execute source of "${tool.name}" contains </script or <!--`);
    return tool.execute;
  });
  const config = {
    paths: options.paths,
    patterns: options.pathPatterns ?? [],
    tools: options.tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema: toWebMcpInputSchema(inputSchema) })),
  };
  return String.raw`(function(){try{
var mc=document.modelContext||navigator.modelContext;
if(!mc||typeof mc.registerTool!=="function"||window.${options.flag})return;
var C=${toScriptJson(config)};
var p=location.pathname;
if(C.paths.indexOf(p)<0&&!C.patterns.some(function(s){return new RegExp(s).test(p);}))return;
window.${options.flag}=true;
function strip(t){return String(t).replace(/^---\n[\s\S]*?\n---\n+/,"");}
var h={ok:function(t){return{content:[{type:"text",text:String(t)}]};},error:function(t){return{content:[{type:"text",text:String(t)}],isError:true};},stripFrontmatter:strip,fetchMarkdown:function(path){return fetch(path,{headers:{Accept:"text/markdown"},credentials:"omit"}).then(function(r){if(!r.ok)throw new Error(path+": HTTP "+r.status);return r.text();}).then(strip);}};
var X=[${executes.map((source) => `(\n${source}\n)`).join(",")}];
C.tools.forEach(function(d,i){var t={name:d.name,description:d.description,inputSchema:d.inputSchema,execute:function(a){try{return Promise.resolve(X[i](a,h)).catch(function(e){return h.error(d.name+": "+(e&&e.message?e.message:e));});}catch(e){return Promise.resolve(h.error(d.name+": "+(e&&e.message?e.message:e)));}}};try{var r=mc.registerTool(t);if(r&&typeof r.then==="function")r.then(null,function(e){console.warn("WebMCP: "+d.name+": "+e);});}catch(e){console.warn("WebMCP: "+d.name+": "+e);}});
}catch(e){console.warn("WebMCP: "+e);}})();`;
}

// Ready-made tools (#415): a site search over the Markdown versions of the public pages (seo's `Accept: text/markdown`)
// and a glossary lookup (the blog glossary's `DefinedTermSet`). Everything they read is cached for the page's lifetime,
// except what failed, so the next call tries it again.

/** A page's Markdown with the title of its frontmatter (seo writes a JSON-quoted `title`). */
interface MarkdownPage {
  title: string | null;
  body: string;
}

const FRONTMATTER_PATTERN = /^---\n([\s\S]*?)\n---\n+/;

function readMarkdownPage(text: string): MarkdownPage {
  const frontmatter = FRONTMATTER_PATTERN.exec(text);
  const titleLine = frontmatter === null ? null : /^title:[ \t]*(.*)$/m.exec(frontmatter[1] ?? "");
  return { title: titleLine === null ? null : readFrontmatterValue(titleLine[1] ?? ""), body: stripFrontmatter(text) };
}

function readFrontmatterValue(raw: string): string | null {
  const value = raw.trim();
  if (!value.startsWith('"')) return value === "" ? null : value;
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === "string" && parsed !== "" ? parsed : null;
  } catch {
    return null;
  }
}

async function fetchText(fetchImpl: typeof fetch, path: string, accept: string): Promise<string> {
  const response = await fetchImpl(path, { headers: { Accept: accept }, credentials: "omit" });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.text();
}

/** A cache of promises that forgets a rejected one, so a failed read is retried on the next call. */
function createCache<T>(load: (key: string) => Promise<T>): (key: string) => Promise<T> {
  const entries = new Map<string, Promise<T>>();
  return (key) => {
    const cached = entries.get(key);
    if (cached !== undefined) return cached;
    const promise = load(key);
    entries.set(key, promise);
    promise.catch(() => entries.delete(key));
    return promise;
  };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Letters NFKD leaves whole that a reader types without their mark, by code point: L, D and O with stroke. */
const FOLDED_LETTERS: ReadonlyMap<number, string> = new Map([
  [0x141, "l"],
  [0x142, "l"],
  [0x110, "d"],
  [0x111, "d"],
  [0xd8, "o"],
  [0xf8, "o"],
]);

function foldChar(char: string): string {
  const mapped = FOLDED_LETTERS.get(char.charCodeAt(0));
  if (mapped !== undefined) return mapped;
  const base = char.normalize("NFKD").charAt(0).toLowerCase();
  return base.length === 1 ? base : char;
}

/** Lower case without diacritics, one character for each character, so an index in the result is one in the input. */
function fold(text: string): string {
  return text.replace(/[^a-z0-9\s]/g, foldChar);
}

function toWords(text: string): string[] {
  return [...new Set(fold(text).split(/[^\p{L}\p{N}]+/u).filter((word) => word !== ""))];
}

function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  for (let index = haystack.indexOf(needle); index >= 0; index = haystack.indexOf(needle, index + needle.length)) count += 1;
  return count;
}

/** The path (and query) of a URL, absolute or root-relative. */
function toPath(url: string): string | null {
  if (!URL.canParse(url, "http://localhost")) return null;
  const parsed = new URL(url, "http://localhost");
  return `${parsed.pathname}${parsed.search}`;
}

/**
 * A text that depends on a count: one template, or one per plural category of `Intl.PluralRules` (`zero`, `one`,
 * `two`, `few`, `many`), with `other` as the fallback.
 */
export type WebMcpPluralText = string | (Partial<Record<Intl.LDMLPluralRule, string>> & { other: string });

/** Fills `{key}` placeholders in one pass: a value holding `{x}` is not expanded again, an unknown key stays as written. */
function formatText(template: string, values: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => (Object.hasOwn(values, key) ? String(values[key]) : whole));
}

/** The defaults with every override that is set; a key passed as `undefined` keeps its default. */
function mergeMessages<T extends object>(defaults: Readonly<T>, overrides: Partial<T> | undefined): T {
  const set = Object.entries(overrides ?? {}).filter(([, value]) => value !== undefined);
  return { ...defaults, ...(Object.fromEntries(set) as Partial<T>) };
}

function selectPlural(text: WebMcpPluralText, count: number, rules: Intl.PluralRules): string {
  return typeof text === "string" ? text : (text[rules.select(count)] ?? text.other);
}

function readNonEmptyString(args: unknown, key: string): string | null {
  const value = typeof args === "object" && args !== null ? (args as Record<string, unknown>)[key] : undefined;
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

/** Where `searchSite` finds the pages: a sitemap read at the first search, or a fixed list of paths. */
export type SearchSitePages = { sitemap: string } | { paths: readonly string[] };

export interface SearchSiteToolOptions {
  /** Default `{ sitemap: "/sitemap.xml" }` (seo's). Each `<loc>` is taken as a path on the page's own origin. */
  pages?: SearchSitePages;
  /** The most pages read, the first ones listed; default 50. */
  maxPages?: number;
  /** Default `searchSite`. */
  name?: string;
  description?: string;
  /** Overrides of the answer lines and input descriptions, e.g. an app's own translation; English by default. */
  messages?: Partial<SearchSiteMessages>;
  /** The BCP 47 locale whose plural rules pick the forms of a `WebMcpPluralText`; default `en`. */
  locale?: string;
  /** Default the browser's `fetch`. */
  fetchImpl?: typeof fetch;
}

/** What `searchSite` says. `{placeholders}` are filled in; the tool's name prefixes the error lines. */
export interface SearchSiteMessages {
  /** The `query` input's description. */
  queryDescription: string;
  /** The `limit` input's description. */
  limitDescription: string;
  /** Error: the query is missing or empty. */
  invalidQuery: string;
  /** Error: no listed page could be read. `{error}`: the first failure. */
  noPageRead: string;
  /** Every listed page was read. `{count}`. */
  searched: WebMcpPluralText;
  /** Some pages were not read (cut at `maxPages` or failed). `{read}`, `{total}`; the plural follows `{total}`. */
  searchedSome: WebMcpPluralText;
  /** Appended when pages failed. `{scope}`: the line before, `{count}`: the failed pages. */
  failed: WebMcpPluralText;
  /** No page holds every word. `{query}`, `{scope}`. */
  noMatch: string;
  /** The first line of an answer. `{count}`, `{query}`, `{scope}`. */
  matches: WebMcpPluralText;
}

export const SEARCH_SITE_MESSAGES: Readonly<SearchSiteMessages> = {
  queryDescription: "Words to look for; a page matches when it has every word.",
  limitDescription: "The most pages to answer.",
  invalidQuery: "query must be a non-empty string",
  noPageRead: "no page could be read ({error})",
  searched: { one: "{count} page searched", other: "{count} pages searched" },
  searchedSome: "{read} of {total} pages searched",
  failed: "{scope}; {count} failed",
  noMatch: 'No page matches "{query}" ({scope}).',
  matches: { one: '{count} page matches "{query}" ({scope}).', other: '{count} pages match "{query}" ({scope}).' },
};

const SEARCH_SITE_DESCRIPTION =
  "Searches the public pages of this site and answers the best matching pages with their titles, paths and a snippet. Read a page in full by fetching its path with Accept: text/markdown.";

const SEARCH_LIMIT_DEFAULT = 5;
const SEARCH_LIMIT_MAX = 20;
const MAX_PAGES_DEFAULT = 50;
const READ_CONCURRENCY = 4;
const SNIPPET_BEFORE = 80;
const SNIPPET_AFTER = 160;

function buildSearchSiteInputSchema(messages: SearchSiteMessages): Record<string, unknown> {
  return {
    type: "object",
    properties: {
      query: { type: "string", minLength: 1, description: messages.queryDescription },
      limit: { type: "integer", minimum: 1, maximum: SEARCH_LIMIT_MAX, default: SEARCH_LIMIT_DEFAULT, description: messages.limitDescription },
    },
    required: ["query"],
    additionalProperties: false,
  };
}

/** The predefined XML entities, decoded in one pass so `&amp;lt;` stays `&lt;`. */
const XML_ENTITIES: Readonly<Record<string, string>> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function readSitemapPaths(xml: string): string[] {
  const paths: string[] = [];
  for (const match of xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)) {
    const loc = (match[1] ?? "").replace(/&(amp|lt|gt|quot|apos);/g, (_, name: string) => XML_ENTITIES[name] ?? "");
    const path = toPath(loc);
    if (path !== null && !path.endsWith(".xml") && !paths.includes(path)) paths.push(path);
  }
  return paths;
}

async function mapConcurrently<T, R>(items: readonly T[], limit: number, map: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await map(items[index] as T);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

interface PageMatch {
  path: string;
  title: string;
  score: number;
  snippet: string;
}

function matchPage(path: string, page: MarkdownPage, words: readonly string[]): PageMatch | null {
  const title = page.title ?? /^#\s+(.+)$/m.exec(page.body)?.[1]?.trim() ?? path;
  const foldedTitle = fold(title);
  const foldedBody = fold(page.body);
  let score = 0;
  let first = -1;
  for (const word of words) {
    const inTitle = countOccurrences(foldedTitle, word);
    const inBody = countOccurrences(foldedBody, word);
    if (inTitle + inBody === 0) return null;
    score += inTitle * 10 + inBody;
    const index = foldedBody.indexOf(word);
    if (index >= 0 && (first < 0 || index < first)) first = index;
  }
  return { path, title, score, snippet: cutSnippet(page.body, Math.max(first, 0)) };
}

function cutSnippet(body: string, at: number): string {
  const start = Math.max(0, at - SNIPPET_BEFORE);
  const end = Math.min(body.length, at + SNIPPET_AFTER);
  const text = body.slice(start, end).replace(/\s+/g, " ").trim();
  return `${start > 0 ? "…" : ""}${text}${end < body.length ? "…" : ""}`;
}

/**
 * `searchSite({ query, limit? })`: reads the Markdown version of every listed public page (once, then from memory) and
 * answers the pages that hold every word of the query, best first (a title match weighs ten body matches), each with
 * its title, path and a snippet. Case and diacritics are ignored. A page that cannot be read is skipped and counted.
 */
export function createSearchSiteTool(options: SearchSiteToolOptions = {}): WebMcpTool {
  const name = options.name ?? "searchSite";
  const pages = options.pages ?? { sitemap: "/sitemap.xml" };
  const maxPages = options.maxPages ?? MAX_PAGES_DEFAULT;
  const fetchImpl: typeof fetch = (input, init) => (options.fetchImpl ?? fetch)(input, init);
  const readPaths = createCache(async (sitemap) => readSitemapPaths(await fetchText(fetchImpl, sitemap, "application/xml, text/xml")));
  const readPage = createCache(async (path) => readMarkdownPage(await fetchText(fetchImpl, path, "text/markdown")));
  const messages: SearchSiteMessages = mergeMessages(SEARCH_SITE_MESSAGES, options.messages);
  const rules = new Intl.PluralRules(options.locale ?? "en");
  const say = (text: WebMcpPluralText, values: Readonly<Record<string, string | number>>, count = 0) =>
    formatText(selectPlural(text, count, rules), values);

  const execute = async (args: unknown): Promise<WebMcpToolResult> => {
    const query = readNonEmptyString(args, "query");
    const words = query === null ? [] : toWords(query);
    if (query === null || words.length === 0) return errorResult(`${name}: ${say(messages.invalidQuery, {})}`);
    const requested = (args as { limit?: unknown }).limit;
    const limit = typeof requested === "number" && Number.isInteger(requested) ? Math.min(Math.max(requested, 1), SEARCH_LIMIT_MAX) : SEARCH_LIMIT_DEFAULT;

    let paths: readonly string[];
    try {
      paths = "paths" in pages ? pages.paths : await readPaths(pages.sitemap);
    } catch (error) {
      return errorResult(`${name}: ${getErrorMessage(error)}`);
    }
    const reads = await mapConcurrently(paths.slice(0, maxPages), READ_CONCURRENCY, (path) =>
      readPage(path).then(
        (page) => ({ path, page, error: null }),
        (error: unknown) => ({ path, page: null, error: getErrorMessage(error) }),
      ),
    );
    const failures = reads.filter((read) => read.page === null);
    if (reads.length > 0 && failures.length === reads.length) {
      return errorResult(`${name}: ${say(messages.noPageRead, { error: failures[0]?.error ?? "" })}`);
    }

    const read = reads.length - failures.length;
    const total = paths.length;
    const searched =
      read === total ? say(messages.searched, { count: read }, read) : say(messages.searchedSome, { read, total }, total);
    const scope = failures.length > 0 ? say(messages.failed, { scope: searched, count: failures.length }, failures.length) : searched;
    const matches = reads
      .flatMap((entry) => {
        const match = entry.page === null ? null : matchPage(entry.path, entry.page, words);
        return match === null ? [] : [match];
      })
      .sort((a, b) => b.score - a.score);
    if (matches.length === 0) return textResult(say(messages.noMatch, { query, scope }));
    const lines = matches.slice(0, limit).map((match, index) => `${index + 1}. ${match.title} (${match.path})\n   ${match.snippet}`);
    return textResult([say(messages.matches, { count: matches.length, query, scope }, matches.length), "", ...lines].join("\n"));
  };

  return {
    name,
    description: options.description ?? SEARCH_SITE_DESCRIPTION,
    inputSchema: buildSearchSiteInputSchema(messages),
    execute,
  };
}

export interface FindTermToolOptions {
  /** The glossary index page, whose JSON-LD `DefinedTermSet` lists the terms (blog's); default `/blog/glossary`. */
  glossary?: string;
  /** Default `findTerm`. */
  name?: string;
  description?: string;
  /** Overrides of the answer lines and the input description, e.g. an app's own translation; English by default. */
  messages?: Partial<FindTermMessages>;
  /** Default the browser's `fetch`. */
  fetchImpl?: typeof fetch;
}

/** What `findTerm` says. `{placeholders}` are filled in; the tool's name prefixes the error line. */
export interface FindTermMessages {
  /** The `term` input's description. */
  termDescription: string;
  /** Error: the term is missing or empty. */
  invalidTerm: string;
  /** The glossary page lists no term. */
  emptyGlossary: string;
  /** No term matches. `{term}`. */
  noMatch: string;
  /** The line above the list of partial matches. `{term}`. */
  closeTerms: string;
}

export const FIND_TERM_MESSAGES: Readonly<FindTermMessages> = {
  termDescription: "The term to define, e.g. a word from a page.",
  invalidTerm: "term must be a non-empty string",
  emptyGlossary: "The glossary has no terms.",
  noMatch: 'No glossary term matches "{term}".',
  closeTerms: 'No glossary term is exactly "{term}". Close terms:',
};

const FIND_TERM_DESCRIPTION = "Looks a term up in this site's glossary and answers its definition. With no exact match it lists the close terms.";

interface GlossaryTerm {
  name: string;
  description: string;
  path: string;
}

const TERM_PAGE_MAX_LENGTH = 8000;
const CLOSE_TERMS_MAX = 10;

function buildFindTermInputSchema(messages: FindTermMessages): Record<string, unknown> {
  return {
    type: "object",
    properties: { term: { type: "string", minLength: 1, description: messages.termDescription } },
    required: ["term"],
    additionalProperties: false,
  };
}

function hasType(node: Record<string, unknown>, type: string): boolean {
  const value = node["@type"];
  return value === type || (Array.isArray(value) && value.includes(type));
}

/** Every `DefinedTerm` with a name and a URL in the page's JSON-LD scripts, `@graph` and nesting included. */
function readGlossaryTerms(html: string): GlossaryTerm[] {
  const terms: GlossaryTerm[] = [];
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (typeof node !== "object" || node === null) return;
    const record = node as Record<string, unknown>;
    if (hasType(record, "DefinedTerm") && typeof record.name === "string" && typeof record.url === "string") {
      const path = toPath(record.url);
      if (path !== null && !terms.some((term) => term.path === path)) {
        terms.push({ name: record.name, description: typeof record.description === "string" ? record.description : "", path });
      }
    }
    Object.values(record).forEach(visit);
  };
  for (const match of html.matchAll(/<script[^>]*type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      visit(JSON.parse(match[1] ?? ""));
    } catch {
      // A broken block on the page is not this tool's to report: the other blocks still count.
    }
  }
  return terms;
}

function toSlug(text: string): string {
  return fold(text).replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "");
}

/** The term named `wanted`: its exact name, else its URL's last segment, else the only term that partly matches. */
function findTerms(terms: readonly GlossaryTerm[], wanted: string): { exact: GlossaryTerm } | { close: GlossaryTerm[] } {
  const folded = fold(wanted);
  const exact = terms.find((term) => fold(term.name) === folded) ?? terms.find((term) => term.path.split("/").pop() === toSlug(wanted));
  if (exact !== undefined) return { exact };
  const close = terms.filter((term) => {
    const name = fold(term.name);
    return name.includes(folded) || folded.includes(name);
  });
  return close.length === 1 && close[0] !== undefined ? { exact: close[0] } : { close };
}

/**
 * `findTerm({ term })`: finds the term in the glossary (its exact name, its page's slug, or the only partial match) and
 * answers the Markdown of the term's page, or its short definition when that page cannot be read. Several partial
 * matches are listed with their definitions.
 */
export function createFindTermTool(options: FindTermToolOptions = {}): WebMcpTool {
  const name = options.name ?? "findTerm";
  const glossary = options.glossary ?? "/blog/glossary";
  const fetchImpl: typeof fetch = (input, init) => (options.fetchImpl ?? fetch)(input, init);
  const readTerms = createCache(async (path) => readGlossaryTerms(await fetchText(fetchImpl, path, "text/html")));
  const messages: FindTermMessages = mergeMessages(FIND_TERM_MESSAGES, options.messages);

  const execute = async (args: unknown): Promise<WebMcpToolResult> => {
    const wanted = readNonEmptyString(args, "term");
    if (wanted === null) return errorResult(`${name}: ${formatText(messages.invalidTerm, {})}`);
    let terms: GlossaryTerm[];
    try {
      terms = await readTerms(glossary);
    } catch (error) {
      return errorResult(`${name}: ${getErrorMessage(error)}`);
    }
    if (terms.length === 0) return textResult(formatText(messages.emptyGlossary, {}));

    const found = findTerms(terms, wanted);
    if ("close" in found) {
      if (found.close.length === 0) return textResult(formatText(messages.noMatch, { term: wanted }));
      const lines = found.close.slice(0, CLOSE_TERMS_MAX).map((term) => `- ${term.name} (${term.path}): ${term.description}`);
      return textResult([formatText(messages.closeTerms, { term: wanted }), ...lines].join("\n"));
    }
    const term = found.exact;
    let definition: string;
    try {
      definition = readMarkdownPage(await fetchText(fetchImpl, term.path, "text/markdown")).body.trim().slice(0, TERM_PAGE_MAX_LENGTH);
    } catch {
      definition = term.description;
    }
    return textResult(`${term.name} (${term.path})\n\n${definition === "" ? term.description : definition}`);
  };

  return {
    name,
    description: options.description ?? FIND_TERM_DESCRIPTION,
    inputSchema: buildFindTermInputSchema(messages),
    execute,
  };
}

// The same two tools for the inline boot script (#437): a page without a client component cannot run the TypeScript
// above, so each tool is JavaScript source that `buildWebMcpBootScript` inlines. The logic is a second copy of the one
// above, kept in step by running every behaviour test against both forms (tests/webmcp-search.test.ts).

/** `SearchSiteToolOptions` for the boot script: the page's own `fetch` is used. */
export type SearchSiteScriptToolOptions = Omit<SearchSiteToolOptions, "fetchImpl">;

/** `FindTermToolOptions` for the boot script: the page's own `fetch` is used. */
export type FindTermScriptToolOptions = Omit<FindTermToolOptions, "fetchImpl">;

/** Helpers both script tools share. `O` is the tool's configuration; the page's `fetch` reads. */
const SCRIPT_HELPERS = String.raw`
const R = new Intl.PluralRules(O.locale);
const say = (t, v, n) => (typeof t === "string" ? t : (t[R.select(n || 0)] ?? t.other)).replace(/\{(\w+)\}/g, (w, k) => (Object.hasOwn(v, k) ? String(v[k]) : w));
const F = { 321: "l", 322: "l", 272: "d", 273: "d", 216: "o", 248: "o" };
const fold = (t) => t.replace(/[^a-z0-9\s]/g, (c) => { const m = F[c.charCodeAt(0)]; if (m !== undefined) return m; const b = c.normalize("NFKD").charAt(0).toLowerCase(); return b.length === 1 ? b : c; });
const toPath = (u) => { if (!URL.canParse(u, "http://localhost")) return null; const p = new URL(u, "http://localhost"); return p.pathname + p.search; };
const str = (a, k) => { const v = typeof a === "object" && a !== null ? a[k] : undefined; return typeof v === "string" && v.trim() !== "" ? v.trim() : null; };
const msgOf = (e) => (e instanceof Error ? e.message : String(e));
const get = (path, accept) => fetch(path, { headers: { Accept: accept }, credentials: "omit" }).then((r) => { if (!r.ok) throw new Error(path + ": HTTP " + r.status); return r.text(); });
const cache = (load) => { const m = new Map(); return (k) => { let p = m.get(k); if (p === undefined) { p = load(k); m.set(k, p); p.catch(() => m.delete(k)); } return p; }; };
const fmValue = (raw) => { const v = raw.trim(); if (!v.startsWith('"')) return v === "" ? null : v; try { const p = JSON.parse(v); return typeof p === "string" && p !== "" ? p : null; } catch (e) { return null; } };
const mdPage = (t) => { const f = /^---\n([\s\S]*?)\n---\n+/.exec(t); const l = f === null ? null : /^title:[ \t]*(.*)$/m.exec(f[1] ?? ""); return { title: l === null ? null : fmValue(l[1] ?? ""), body: t.replace(/^---\n[\s\S]*?\n---\n+/, "") }; };
`;

const SEARCH_SITE_SCRIPT = String.raw`
const M = O.messages;
const XE = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const words = (t) => [...new Set(fold(t).split(/[^\p{L}\p{N}]+/u).filter((w) => w !== ""))];
const count = (hay, n) => { let c = 0; for (let i = hay.indexOf(n); i >= 0; i = hay.indexOf(n, i + n.length)) c += 1; return c; };
const sitemapPaths = (xml) => { const out = []; for (const m of xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)) { const loc = (m[1] ?? "").replace(/&(amp|lt|gt|quot|apos);/g, (_, n) => XE[n] ?? ""); const p = toPath(loc); if (p !== null && !p.endsWith(".xml") && !out.includes(p)) out.push(p); } return out; };
const readPaths = cache(async (s) => sitemapPaths(await get(s, "application/xml, text/xml")));
const readPage = cache(async (p) => mdPage(await get(p, "text/markdown")));
const mapLimited = async (items, limit, fn) => { const res = new Array(items.length); let next = 0; const worker = async () => { while (next < items.length) { const i = next++; res[i] = await fn(items[i]); } }; await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker)); return res; };
const snippet = (body, at) => { const s = Math.max(0, at - ${SNIPPET_BEFORE}); const e = Math.min(body.length, at + ${SNIPPET_AFTER}); const t = body.slice(s, e).replace(/\s+/g, " ").trim(); return (s > 0 ? "…" : "") + t + (e < body.length ? "…" : ""); };
const match = (path, page, ws) => { const title = page.title ?? /^#\s+(.+)$/m.exec(page.body)?.[1]?.trim() ?? path; const ft = fold(title); const fb = fold(page.body); let score = 0; let first = -1; for (const w of ws) { const a = count(ft, w); const b = count(fb, w); if (a + b === 0) return null; score += a * 10 + b; const i = fb.indexOf(w); if (i >= 0 && (first < 0 || i < first)) first = i; } return { path, title, score, snippet: snippet(page.body, Math.max(first, 0)) }; };
return async (args, h) => {
  const query = str(args, "query");
  const ws = query === null ? [] : words(query);
  if (query === null || ws.length === 0) return h.error(O.name + ": " + say(M.invalidQuery, {}));
  const requested = args.limit;
  const limit = typeof requested === "number" && Number.isInteger(requested) ? Math.min(Math.max(requested, 1), ${SEARCH_LIMIT_MAX}) : ${SEARCH_LIMIT_DEFAULT};
  let paths;
  try { paths = Array.isArray(O.pages.paths) ? O.pages.paths : await readPaths(O.pages.sitemap); } catch (e) { return h.error(O.name + ": " + msgOf(e)); }
  const reads = await mapLimited(paths.slice(0, O.maxPages), ${READ_CONCURRENCY}, (p) => readPage(p).then((page) => ({ path: p, page, error: null }), (e) => ({ path: p, page: null, error: msgOf(e) })));
  const failures = reads.filter((r) => r.page === null);
  if (reads.length > 0 && failures.length === reads.length) return h.error(O.name + ": " + say(M.noPageRead, { error: failures[0].error }));
  const read = reads.length - failures.length;
  const total = paths.length;
  const searched = read === total ? say(M.searched, { count: read }, read) : say(M.searchedSome, { read, total }, total);
  const scope = failures.length > 0 ? say(M.failed, { scope: searched, count: failures.length }, failures.length) : searched;
  const matches = reads.flatMap((r) => { const m = r.page === null ? null : match(r.path, r.page, ws); return m === null ? [] : [m]; }).sort((a, b) => b.score - a.score);
  if (matches.length === 0) return h.ok(say(M.noMatch, { query, scope }));
  const lines = matches.slice(0, limit).map((m, i) => (i + 1) + ". " + m.title + " (" + m.path + ")\n   " + m.snippet);
  return h.ok([say(M.matches, { count: matches.length, query, scope }, matches.length), "", ...lines].join("\n"));
};
`;

const FIND_TERM_SCRIPT = String.raw`
const M = O.messages;
const hasType = (n, t) => n["@type"] === t || (Array.isArray(n["@type"]) && n["@type"].includes(t));
const glossaryTerms = (html) => {
  const terms = [];
  const visit = (n) => {
    if (Array.isArray(n)) { n.forEach(visit); return; }
    if (typeof n !== "object" || n === null) return;
    if (hasType(n, "DefinedTerm") && typeof n.name === "string" && typeof n.url === "string") { const p = toPath(n.url); if (p !== null && !terms.some((t) => t.path === p)) terms.push({ name: n.name, description: typeof n.description === "string" ? n.description : "", path: p }); }
    Object.values(n).forEach(visit);
  };
  for (const m of html.matchAll(/<script[^>]*type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)) { try { visit(JSON.parse(m[1] ?? "")); } catch (e) { /* a broken block: the others still count */ } }
  return terms;
};
const slug = (t) => fold(t).replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "");
const find = (terms, wanted) => { const f = fold(wanted); const exact = terms.find((t) => fold(t.name) === f) ?? terms.find((t) => t.path.split("/").pop() === slug(wanted)); if (exact !== undefined) return { exact }; const close = terms.filter((t) => { const n = fold(t.name); return n.includes(f) || f.includes(n); }); return close.length === 1 ? { exact: close[0] } : { close }; };
const readTerms = cache(async (p) => glossaryTerms(await get(p, "text/html")));
return async (args, h) => {
  const wanted = str(args, "term");
  if (wanted === null) return h.error(O.name + ": " + say(M.invalidTerm, {}));
  let terms;
  try { terms = await readTerms(O.glossary); } catch (e) { return h.error(O.name + ": " + msgOf(e)); }
  if (terms.length === 0) return h.ok(say(M.emptyGlossary, {}));
  const found = find(terms, wanted);
  if (found.close !== undefined) {
    if (found.close.length === 0) return h.ok(say(M.noMatch, { term: wanted }));
    const lines = found.close.slice(0, ${CLOSE_TERMS_MAX}).map((t) => "- " + t.name + " (" + t.path + "): " + t.description);
    return h.ok([say(M.closeTerms, { term: wanted }), ...lines].join("\n"));
  }
  const term = found.exact;
  let definition;
  try { definition = mdPage(await get(term.path, "text/markdown")).body.trim().slice(0, ${TERM_PAGE_MAX_LENGTH}); } catch (e) { definition = term.description; }
  return h.ok(term.name + " (" + term.path + ")\n\n" + (definition === "" ? term.description : definition));
};
`;

/** An `execute` source: an expression that runs once per page load and yields `async (args, h) => result`. */
function buildScriptExecute(config: Readonly<Record<string, unknown>>, body: string): string {
  return `(() => {\nconst O = ${toScriptJson(config)};${SCRIPT_HELPERS}${body}})()`;
}

/** Throws a RangeError, at build time rather than in the page, when `locale` is not a BCP 47 tag. */
function checkLocale(locale: string): string {
  Intl.getCanonicalLocales(locale);
  return locale;
}

/**
 * `searchSite` for `buildWebMcpBootScript({ tools })`: the same definition and answers as `createSearchSiteTool`, as
 * JavaScript source that reads with the page's `fetch`.
 */
export function searchSiteScriptTool(options: SearchSiteScriptToolOptions = {}): WebMcpScriptTool {
  const name = options.name ?? "searchSite";
  const messages: SearchSiteMessages = mergeMessages(SEARCH_SITE_MESSAGES, options.messages);
  const config = {
    name,
    pages: options.pages ?? { sitemap: "/sitemap.xml" },
    maxPages: options.maxPages ?? MAX_PAGES_DEFAULT,
    locale: checkLocale(options.locale ?? "en"),
    messages,
  };
  return {
    name,
    description: options.description ?? SEARCH_SITE_DESCRIPTION,
    inputSchema: buildSearchSiteInputSchema(messages),
    execute: buildScriptExecute(config, SEARCH_SITE_SCRIPT),
  };
}

/**
 * `findTerm` for `buildWebMcpBootScript({ tools })`: the same definition and answers as `createFindTermTool`, as
 * JavaScript source that reads with the page's `fetch`.
 */
export function findTermScriptTool(options: FindTermScriptToolOptions = {}): WebMcpScriptTool {
  const name = options.name ?? "findTerm";
  const messages: FindTermMessages = mergeMessages(FIND_TERM_MESSAGES, options.messages);
  const config = { name, glossary: options.glossary ?? "/blog/glossary", locale: "en", messages };
  return {
    name,
    description: options.description ?? FIND_TERM_DESCRIPTION,
    inputSchema: buildFindTermInputSchema(messages),
    execute: buildScriptExecute(config, FIND_TERM_SCRIPT),
  };
}

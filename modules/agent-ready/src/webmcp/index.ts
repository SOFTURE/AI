// WebMCP: tools a public page offers an agent running in the browser (`document.modelContext.registerTool`). Browser
// only: no Node imports. The tools themselves are the app's; this entry gives their types, the result helpers, a
// registration that bridges both API generations, and an inline boot script for pages that ship no client component.

/** A tool result in the MCP shape: an object, not a string (scanners check it). */
export interface WebMcpToolResult {
  content: { type: "text"; text: string }[];
  isError?: boolean;
}

/** A tool without `execute`: what a boot script or a component completes. */
export interface WebMcpToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/** A tool as `registerTool` takes it. */
export interface WebMcpTool extends WebMcpToolDefinition {
  execute: (args: unknown) => Promise<WebMcpToolResult>;
}

/** The part of the WebMCP API used here. Newer browsers take `{ signal }`; older ones return `{ unregister() }`. */
export interface ModelContextLike {
  registerTool: (tool: WebMcpTool, options?: { signal?: AbortSignal }) => unknown;
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
    handle = modelContext.registerTool(tool, { signal });
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
    tools: options.tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
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

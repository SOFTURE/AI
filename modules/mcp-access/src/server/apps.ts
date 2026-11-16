// MCP Apps (the `io.modelcontextprotocol/ui` extension, protocol 2026-01-26): a tool names a `ui://` HTML resource in
// its `_meta`, and a host that supports the extension (Claude, ChatGPT, VS Code) renders that page in a sandboxed
// iframe next to the tool's answer. The page talks to the host over `postMessage` JSON-RPC: it receives the tool's
// input and result, and may call the server's tools itself (a slider that re-runs a simulation).
//
// This file gives the server half (the tool `_meta`, the resource with the right MIME type) and a dependency-free
// browser bridge that a page embeds inline, so an app ships one self-contained HTML string and needs no bundler:
//
//   registerAppResource(server, { name: "overview", uri: "ui://acme/overview.html", html: renderAppDocument({ ... }) });
//   server.registerTool("get_overview", { description, inputSchema, _meta: appToolMeta("ui://acme/overview.html") }, handler);
//
// A host without the extension ignores both and shows the tool's text answer as before.
import type { McpServer } from "@modelcontextprotocol/server";

/** The MIME type a host requires on an MCP App resource. */
export const MCP_APP_MIME_TYPE = "text/html;profile=mcp-app";

/** The MCP Apps protocol version the bridge asks for in `ui/initialize`. */
export const MCP_APP_PROTOCOL_VERSION = "2026-01-26";

/** The legacy flat `_meta` key some hosts still read instead of `_meta.ui.resourceUri`. */
export const MCP_APP_LEGACY_URI_KEY = "ui/resourceUri";

/** Who may call a tool: the model, the app's page, or both (the host's default). */
export type McpAppToolVisibility = "model" | "app";

export interface AppToolMetaOptions {
  /** `["app"]` hides a helper tool from the model; omitted, both may call it. */
  readonly visibility?: readonly McpAppToolVisibility[];
}

/** Origins the page may reach, by kind; omitted, the host allows none (the page must be self-contained). */
export interface McpAppCsp {
  readonly connectDomains?: readonly string[];
  readonly resourceDomains?: readonly string[];
  readonly frameDomains?: readonly string[];
}

export interface AppResourceOptions {
  /** The resource's registered name. */
  readonly name: string;
  /** A `ui://` URI, the one the tool's `appToolMeta` names. */
  readonly uri: string;
  readonly title?: string;
  readonly description?: string;
  /** The whole page; `renderAppDocument` builds one with the bridge inside. */
  readonly html: string | (() => string | Promise<string>);
  readonly csp?: McpAppCsp;
  /** Asks the host to draw a border around the page. */
  readonly prefersBorder?: boolean;
}

function assertAppUri(uri: string): void {
  if (!uri.startsWith("ui://") || uri.length <= "ui://".length) {
    throw new Error(`@softure-ai/mcp-access: an MCP App resource needs a ui:// URI, got "${uri}"`);
  }
}

/**
 * The `_meta` of a tool that opens an MCP App: `ui.resourceUri` (current hosts) and the flat `ui/resourceUri`
 * (older ones). Spread it into `registerTool`'s config as `_meta`.
 */
export function appToolMeta(resourceUri: string, options: AppToolMetaOptions = {}): Record<string, unknown> {
  assertAppUri(resourceUri);
  const ui = options.visibility === undefined ? { resourceUri } : { resourceUri, visibility: [...options.visibility] };
  return { ui, [MCP_APP_LEGACY_URI_KEY]: resourceUri };
}

/** Registers the HTML page of an MCP App as a `ui://` resource with the MIME type and `_meta.ui` a host expects. */
export function registerAppResource(server: McpServer, options: AppResourceOptions): void {
  assertAppUri(options.uri);
  const uiMeta: Record<string, unknown> = {};
  if (options.csp !== undefined) uiMeta.csp = options.csp;
  if (options.prefersBorder !== undefined) uiMeta.prefersBorder = options.prefersBorder;
  const meta = Object.keys(uiMeta).length === 0 ? undefined : { ui: uiMeta };
  server.registerResource(
    options.name,
    options.uri,
    {
      mimeType: MCP_APP_MIME_TYPE,
      ...(options.title === undefined ? {} : { title: options.title }),
      ...(options.description === undefined ? {} : { description: options.description }),
      ...(meta === undefined ? {} : { _meta: meta }),
    },
    async () => {
      const text = typeof options.html === "string" ? options.html : await options.html();
      return { contents: [{ uri: options.uri, mimeType: MCP_APP_MIME_TYPE, text, ...(meta === undefined ? {} : { _meta: meta }) }] };
    },
  );
}

/**
 * The browser bridge, as one inline script. It defines `window.mcpApp`:
 *
 * - `onToolInput(fn)`: `fn(args)` with the arguments of the call that opened the page.
 * - `onToolResult(fn)`: `fn(data, result)`; `data` is `structuredContent`, else the first text block read as JSON
 *   (else the text itself), `null` for an error result.
 * - `onHostContext(fn)`: `fn(context)` on start and whenever the host changes it (theme, size, locale).
 * - `callTool(name, args)`: calls a server tool through the host; resolves `{ data, result }`, rejects with an
 *   `Error` whose message is the tool's error text.
 * - `sendMessage(text)`, `openLink(url)`: ask the host to post a chat message or open a link.
 * - `ready`: a promise of the host context once `ui/initialize` answered.
 *
 * It applies the host's theme (`data-theme` and `color-scheme` on `<html>`) and style variables, and reports the
 * page's height so the host sizes the frame. A callback registered after an event fired gets the last value at once.
 */
export const MCP_APP_BRIDGE_SCRIPT = `(function () {
  "use strict";
  var host = window.parent;
  var nextId = 1;
  var pending = {};
  var listeners = { input: [], result: [], context: [] };
  var last = {};
  var context = {};

  function post(message) { host.postMessage(Object.assign({ jsonrpc: "2.0" }, message), "*"); }
  function request(method, params) {
    var id = nextId++;
    return new Promise(function (resolve, reject) {
      pending[id] = { resolve: resolve, reject: reject };
      post({ id: id, method: method, params: params || {} });
    });
  }
  function notify(method, params) { post({ method: method, params: params || {} }); }
  function emit(kind, args) {
    last[kind] = args;
    listeners[kind].forEach(function (fn) { fn.apply(null, args); });
  }
  function on(kind) {
    return function (fn) {
      listeners[kind].push(fn);
      if (last[kind] !== undefined) fn.apply(null, last[kind]);
    };
  }
  function textOf(result) {
    var blocks = (result && result.content) || [];
    for (var i = 0; i < blocks.length; i++) if (blocks[i] && blocks[i].type === "text") return blocks[i].text;
    return null;
  }
  function readData(result) {
    if (!result || result.isError) return null;
    if (result.structuredContent !== undefined) return result.structuredContent;
    var text = textOf(result);
    if (text === null) return null;
    try { return JSON.parse(text); } catch (error) { return text; }
  }
  function applyContext(update) {
    context = Object.assign({}, context, update || {});
    var root = document.documentElement;
    if (context.theme === "dark" || context.theme === "light") {
      root.setAttribute("data-theme", context.theme);
      root.style.colorScheme = context.theme;
    }
    var variables = context.styles && context.styles.variables;
    if (variables) Object.keys(variables).forEach(function (name) {
      if (typeof variables[name] === "string") root.style.setProperty(name, variables[name]);
    });
    emit("context", [context]);
  }

  window.addEventListener("message", function (event) {
    if (event.source !== host) return;
    var message = event.data;
    if (!message || message.jsonrpc !== "2.0") return;
    if (message.id !== undefined && message.method === undefined) {
      var waiting = pending[message.id];
      if (!waiting) return;
      delete pending[message.id];
      if (message.error) waiting.reject(new Error(message.error.message || "The host refused the request."));
      else waiting.resolve(message.result);
      return;
    }
    if (message.method === "ui/notifications/tool-input") emit("input", [(message.params && message.params.arguments) || {}]);
    else if (message.method === "ui/notifications/tool-result") emit("result", [readData(message.params), message.params]);
    else if (message.method === "ui/notifications/host-context-changed") applyContext(message.params);
    else if (message.id !== undefined) post({ id: message.id, result: {} });
  });

  var ready = request("ui/initialize", {
    protocolVersion: "${MCP_APP_PROTOCOL_VERSION}",
    appInfo: { name: document.title || "mcp-app", version: "1.0.0" },
    appCapabilities: {},
  }).then(function (result) {
    applyContext((result && result.hostContext) || {});
    notify("ui/notifications/initialized");
    return context;
  });

  var lastHeight = -1;
  function reportSize() {
    var height = Math.ceil(document.documentElement.getBoundingClientRect().height);
    if (height === lastHeight) return;
    lastHeight = height;
    notify("ui/notifications/size-changed", { width: Math.ceil(document.documentElement.scrollWidth), height: height });
  }
  if (typeof ResizeObserver === "function") new ResizeObserver(reportSize).observe(document.documentElement);
  ready.then(reportSize, function () {});

  window.mcpApp = {
    ready: ready,
    onToolInput: on("input"),
    onToolResult: on("result"),
    onHostContext: on("context"),
    callTool: function (name, args) {
      return request("tools/call", { name: name, arguments: args || {} }).then(function (result) {
        if (result && result.isError) throw new Error(textOf(result) || "The tool failed.");
        return { data: readData(result), result: result };
      });
    },
    sendMessage: function (text) { return request("ui/message", { role: "user", content: [{ type: "text", text: String(text) }] }); },
    openLink: function (url) { return request("ui/open-link", { url: String(url) }); },
  };
})();`;

export interface AppDocumentOptions {
  /** The page's `<title>`, also the app name the bridge reports. */
  readonly title: string;
  /** `<html lang>`. Default: `en`. */
  readonly lang?: string;
  /** CSS inside one `<style>`. */
  readonly styles?: string;
  /** The `<body>` markup. */
  readonly body: string;
  /** The page's own script; it runs after the bridge, so `window.mcpApp` is there. */
  readonly script?: string;
}

function escapeText(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Keeps a `</script>` or `</style>` inside inline code from closing its element early. */
function guardInline(code: string, tag: "script" | "style"): string {
  return code.replace(new RegExp(`</${tag}`, "gi"), `<\\/${tag}`);
}

/** One self-contained HTML page for an MCP App: the bridge first, then the app's own script. */
export function renderAppDocument(options: AppDocumentOptions): string {
  const requested = options.lang ?? "en";
  const lang = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(requested) ? requested : "en";
  return [
    "<!doctype html>",
    `<html lang="${lang}">`,
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeText(options.title)}</title>`,
    options.styles === undefined ? "" : `<style>${guardInline(options.styles, "style")}</style>`,
    "</head>",
    "<body>",
    options.body,
    `<script>${MCP_APP_BRIDGE_SCRIPT}</script>`,
    options.script === undefined ? "" : `<script>${guardInline(options.script, "script")}</script>`,
    "</body>",
    "</html>",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

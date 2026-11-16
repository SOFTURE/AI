// MCP Apps: a tool names a ui:// page in its `_meta`, the page is a resource with the MCP App MIME type, and the
// inline bridge speaks the host's postMessage JSON-RPC (initialize, tool input and result, tools/call, size).
import { runInNewContext } from "node:vm";
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import {
  appToolMeta,
  MCP_APP_BRIDGE_SCRIPT,
  MCP_APP_MIME_TYPE,
  MCP_APP_PROTOCOL_VERSION,
  registerAppResource,
  renderAppDocument,
} from "@softure-ai/mcp-access/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";

const URI = "ui://acme/overview.html";

interface Answer {
  readonly result?: Record<string, unknown>;
  readonly error?: { readonly message?: string };
}

function createServer(): McpServer {
  const server = new McpServer({ name: "acme", version: "1.0.0" });
  registerAppResource(server, { name: "overview", uri: URI, title: "Overview", html: "<p>hi</p>", prefersBorder: true });
  server.registerTool(
    "get_overview",
    { description: "The overview.", inputSchema: z.object({}), _meta: appToolMeta(URI) },
    () => ({ content: [{ type: "text", text: "{}" }] }),
  );
  return server;
}

async function send(method: string, params: Record<string, unknown>): Promise<Answer> {
  const handler = createMcpHandler(() => createServer(), { responseMode: "json" });
  const response = await handler.fetch(
    new Request("http://localhost/api/mcp", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    }),
  );
  const body = await response.text();
  const data = body.startsWith("event:") ? (body.split("\n").find((line) => line.startsWith("data: "))?.slice(6) ?? "null") : body;
  return JSON.parse(data) as Answer;
}

describe("MCP App server helpers", () => {
  it("names the page in the tool's _meta, in the current and the legacy key", () => {
    expect(appToolMeta(URI)).toEqual({ ui: { resourceUri: URI }, "ui/resourceUri": URI });
    expect(appToolMeta(URI, { visibility: ["app"] })).toEqual({ ui: { resourceUri: URI, visibility: ["app"] }, "ui/resourceUri": URI });
  });

  it("refuses a URI that is not ui://", () => {
    expect(() => appToolMeta("https://acme.test/x.html")).toThrow(/ui:\/\//);
    expect(() => registerAppResource(new McpServer({ name: "a", version: "1" }), { name: "x", uri: "ui://", html: "" })).toThrow(/ui:\/\//);
  });

  it("lists the tool with its ui meta", async () => {
    const answer = await send("tools/list", {});
    const tools = answer.result?.tools as { name: string; _meta?: unknown }[];
    expect(tools.find((tool) => tool.name === "get_overview")?._meta).toEqual({ ui: { resourceUri: URI }, "ui/resourceUri": URI });
  });

  it("serves the page with the MCP App MIME type and its ui meta", async () => {
    const listed = await send("resources/list", {});
    expect(listed.result?.resources).toEqual([
      { uri: URI, name: "overview", title: "Overview", mimeType: MCP_APP_MIME_TYPE, _meta: { ui: { prefersBorder: true } } },
    ]);
    const read = await send("resources/read", { uri: URI });
    expect(read.result?.contents).toEqual([{ uri: URI, mimeType: "text/html;profile=mcp-app", text: "<p>hi</p>", _meta: { ui: { prefersBorder: true } } }]);
  });
});

describe("renderAppDocument", () => {
  it("puts the bridge before the app's script and escapes the title", () => {
    const html = renderAppDocument({ title: "A < B", lang: "pl", body: "<main></main>", script: "mcpApp.ready;" });
    expect(html).toContain('<html lang="pl">');
    expect(html).toContain("<title>A &lt; B</title>");
    expect(html.indexOf("window.mcpApp =")).toBeLessThan(html.indexOf("mcpApp.ready;"));
  });

  it("keeps a closing tag inside inline code from ending the element", () => {
    const html = renderAppDocument({ title: "x", lang: '"><script>', body: "", script: 'const s = "</script>";', styles: "a{}</style>" });
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('const s = "<\\/script>";');
    expect(html).toContain("a{}<\\/style>");
  });
});

interface Posted {
  readonly id?: number;
  readonly method?: string;
  readonly params?: Record<string, unknown>;
}

interface Bridge {
  readonly ready: Promise<unknown>;
  onToolResult(fn: (data: unknown) => void): void;
  onToolInput(fn: (args: unknown) => void): void;
  callTool(name: string, args: Record<string, unknown>): Promise<{ data: unknown }>;
}

/** Runs the bridge against a fake host window and returns what it posted and how to answer it. */
function startBridge() {
  const posted: Posted[] = [];
  const host = { postMessage: (message: Posted) => posted.push(message) };
  let deliver: (event: { source: unknown; data: unknown }) => void = () => undefined;
  const root = { attributes: {} as Record<string, string>, style: { colorScheme: "", setProperty: () => undefined }, setAttribute(name: string, value: string) { this.attributes[name] = value; }, getBoundingClientRect: () => ({ height: 120 }), scrollWidth: 300 };
  const window: Record<string, unknown> = {
    parent: host,
    addEventListener: (_type: string, listener: typeof deliver) => {
      deliver = listener;
    },
  };
  runInNewContext(MCP_APP_BRIDGE_SCRIPT, { window, document: { title: "Overview", documentElement: root }, Promise, Object });
  const fromHost = (data: unknown) => deliver({ source: host, data });
  const fromStranger = (data: unknown) => deliver({ source: {}, data });
  return { posted, fromHost, fromStranger, root, bridge: window.mcpApp as Bridge };
}

describe("MCP App bridge", () => {
  it("initializes, applies the theme, confirms and reports its height", async () => {
    const { posted, fromHost, root, bridge } = startBridge();
    expect(posted[0]).toMatchObject({ jsonrpc: "2.0", id: 1, method: "ui/initialize", params: { protocolVersion: MCP_APP_PROTOCOL_VERSION } });
    fromHost({ jsonrpc: "2.0", id: 1, result: { hostContext: { theme: "dark" } } });
    await bridge.ready;
    await Promise.resolve();
    expect(root.attributes["data-theme"]).toBe("dark");
    expect(posted.map((message) => message.method)).toEqual(["ui/initialize", "ui/notifications/initialized", "ui/notifications/size-changed"]);
    expect(posted[2]?.params).toEqual({ width: 300, height: 120 });
  });

  it("hands over the tool's input and result, structured or JSON text", () => {
    const { fromHost, bridge } = startBridge();
    const seen: unknown[] = [];
    bridge.onToolInput((args) => seen.push(args));
    fromHost({ jsonrpc: "2.0", method: "ui/notifications/tool-input", params: { arguments: { today: "2026-11-16" } } });
    fromHost({ jsonrpc: "2.0", method: "ui/notifications/tool-result", params: { content: [{ type: "text", text: '{"a":1}' }] } });
    bridge.onToolResult((data) => seen.push(data));
    fromHost({ jsonrpc: "2.0", method: "ui/notifications/tool-result", params: { content: [], structuredContent: { b: 2 } } });
    fromHost({ jsonrpc: "2.0", method: "ui/notifications/tool-result", params: { content: [{ type: "text", text: "boom" }], isError: true } });
    expect(seen).toEqual([{ today: "2026-11-16" }, { a: 1 }, { b: 2 }, null]);
  });

  it("ignores messages from anyone but the host", () => {
    const { fromStranger, bridge } = startBridge();
    const seen: unknown[] = [];
    bridge.onToolResult((data) => seen.push(data));
    fromStranger({ jsonrpc: "2.0", method: "ui/notifications/tool-result", params: { structuredContent: { forged: true } } });
    expect(seen).toEqual([]);
  });

  it("calls a server tool through the host and rejects its error text", async () => {
    const { posted, fromHost, bridge } = startBridge();
    const call = bridge.callTool("simulate", { targetAge: 50 });
    expect(posted[1]).toMatchObject({ id: 2, method: "tools/call", params: { name: "simulate", arguments: { targetAge: 50 } } });
    fromHost({ jsonrpc: "2.0", id: 2, result: { content: [{ type: "text", text: '{"ok":true}' }] } });
    await expect(call).resolves.toMatchObject({ data: { ok: true } });

    const failing = bridge.callTool("simulate", {});
    fromHost({ jsonrpc: "2.0", id: 3, result: { content: [{ type: "text", text: "No data." }], isError: true } });
    await expect(failing).rejects.toThrow("No data.");
  });
});

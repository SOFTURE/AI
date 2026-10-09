// The MCP server factory outside the config (#316): routes built with `createAgentReadyRoutes({ createServer })`, the
// factory contract shared with mcp-access, and what a route answers when no factory is given anywhere.
import { McpServer } from "@modelcontextprotocol/server";
import { agentReady, createDiscoveryIdentity, type AgentReadyOptionsInput, type McpDiscoveryIdentity } from "@softure-ai/agent-ready";
import { createAgentReadyRoutes, serveApiCatalog, serveMcpServerCard } from "@softure-ai/agent-ready/next";
import { auth } from "@softure-ai/auth";
import { defineSoftureConfig } from "@softure-ai/core";
import { clearSoftureConfig, registerSoftureConfig } from "@softure-ai/core/next";
import { mcpAccess, MCP_RATE_LIMIT_BUCKETS } from "@softure-ai/mcp-access";
import type { McpServerFactory as McpAccessServerFactory } from "@softure-ai/mcp-access/server";
import { headerIp, security } from "@softure-ai/security";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { APP, BASE_OPTIONS, createRequest } from "./support.js";

/** The factory an app gives mcp-access's `createMcpRoute`: write tools only for an identity that may write. */
const createServer: McpAccessServerFactory = (identity) => {
  const server = new McpServer({ name: "example", version: "2.4.0" });
  server.registerTool("get_summary", { description: "Reads the summary.", annotations: { readOnlyHint: true } }, () => ({
    content: [{ type: "text", text: `summary of ${identity.userId}` }],
  }));
  if (identity.canWrite) {
    server.registerTool("add_note", { description: "Adds a note.", inputSchema: z.object({ text: z.string() }) }, ({ text }) => ({
      content: [{ type: "text", text }],
    }));
  }
  return server;
};

/** The app's options with no MCP server in the config. */
const OPTIONS_WITHOUT_SERVER: AgentReadyOptionsInput = { ...BASE_OPTIONS, mcp: {} };

function register(options: Partial<AgentReadyOptionsInput> = {}, mcpAccessOptions?: { allowWrites: boolean }): void {
  const modules = [agentReady({ ...OPTIONS_WITHOUT_SERVER, ...options })];
  const withMcpAccess = (allowWrites: boolean) => [
    security({ clientIp: headerIp("x-real-ip"), buckets: { ...MCP_RATE_LIMIT_BUCKETS } }),
    auth({}),
    mcpAccess({ serverName: "example", allowWrites }),
    ...modules,
  ];
  registerSoftureConfig(
    defineSoftureConfig({
      database: { url: "pglite://" },
      locale: "en",
      timezone: "Europe/Warsaw",
      appOrigin: APP,
      modules: mcpAccessOptions === undefined ? modules : withMcpAccess(mcpAccessOptions.allowWrites),
    }),
  );
}

function get(path: string): Request {
  return createRequest(path, "app.example.com");
}

async function readToolNames(response: Response): Promise<string[]> {
  const card = (await response.json()) as { tools: Array<{ name: string }> };
  return card.tools.map((tool) => tool.name);
}

afterEach(() => {
  clearSoftureConfig();
  vi.restoreAllMocks();
});

describe("the factory outside the config", () => {
  it("accepts a config without mcp.server", () => {
    expect(() => agentReady(OPTIONS_WITHOUT_SERVER)).not.toThrow();
  });

  it("serves every document that introspects the server from the routes' factory", async () => {
    register();
    const routes = createAgentReadyRoutes({ createServer });
    expect(await readToolNames(await routes.serveMcpServerCard(get("/.well-known/mcp/server-card.json")))).toEqual(["get_summary", "add_note"]);
    const a2a = (await (await routes.serveA2aAgentCard(get("/.well-known/agent-card.json"))).json()) as { skills: Array<{ id: string }> };
    expect(a2a.skills.map((skill) => skill.id)).toEqual(["get_summary", "add_note"]);
    const index = (await (await routes.serveAgentSkillsIndex(get("/.well-known/agent-skills/index.json"))).json()) as { skills: Array<{ name: string }> };
    expect(index.skills.map((skill) => skill.name)).toEqual(["app-mcp"]);
    const skill = await routes.serveAgentSkill(get("/x"), { params: Promise.resolve({ name: "app-mcp" }) });
    expect(await skill.text()).toContain("- `add_note`: Adds a note.");
    expect((await routes.serveAiCatalog(get("/.well-known/ai-catalog.json"))).status).toBe(200);
    expect((await routes.serveApiCatalog(get("/.well-known/api-catalog"))).status).toBe(200);
  });

  it("prefers the routes' factory over mcp.server in the config", async () => {
    const configured = vi.fn(createServer);
    register({ mcp: { server: configured } });
    const routes = createAgentReadyRoutes({ createServer });
    expect((await routes.serveMcpServerCard(get("/.well-known/mcp/server-card.json"))).status).toBe(200);
    expect(configured).not.toHaveBeenCalled();
  });

  it("answers 500 and names the fix when no factory is given anywhere; documents without the server still answer", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    register();
    expect((await serveMcpServerCard(get("/.well-known/mcp/server-card.json"))).status).toBe(500);
    expect(String(log.mock.calls[0]?.[0])).toContain("no MCP server factory: pass createServer to createAgentReadyRoutes() or set mcp.server");
    expect((await serveApiCatalog(get("/.well-known/api-catalog"))).status).toBe(200);
  });
});

describe("one factory contract with mcp-access", () => {
  it("calls the factory with an anonymous identity of mcp-access's shape", async () => {
    const factory = vi.fn(createServer);
    register();
    await createAgentReadyRoutes({ createServer: factory }).serveMcpServerCard(get("/.well-known/mcp/server-card.json"));
    const expected: McpDiscoveryIdentity = { userId: "00000000-0000-0000-0000-000000000000", canWrite: true, tokenId: "agent-ready-discovery" };
    expect(factory).toHaveBeenCalledWith(expected);
  });

  it("lets the identity write only when mcp-access allows writes", async () => {
    register({}, { allowWrites: false });
    const routes = createAgentReadyRoutes({ createServer });
    expect(await readToolNames(await routes.serveMcpServerCard(get("/.well-known/mcp/server-card.json")))).toEqual(["get_summary"]);
    register({}, { allowWrites: true });
    expect(await readToolNames(await routes.serveMcpServerCard(get("/.well-known/mcp/server-card.json")))).toEqual(["get_summary", "add_note"]);
  });

  it("keeps the old zero-argument factory working in the config", async () => {
    register({ mcp: { server: () => createServer(createDiscoveryIdentity(true)) } });
    expect((await serveMcpServerCard(get("/.well-known/mcp/server-card.json"))).status).toBe(200);
  });
});

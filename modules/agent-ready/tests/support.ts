// Shared setup: the module made the way an app makes it, a real MCP server with one read and one write tool, and the
// configs the route tests register.
import { McpServer } from "@modelcontextprotocol/server";
import {
  agentReady,
  buildResourceDocumentation,
  createAgentAuthExtension,
  createOrigins,
  type AgentDocumentContext,
  type AgentOrigins,
  type AgentReadyOptionsInput,
} from "@softure-ai/agent-ready";
import { auth } from "@softure-ai/auth";
import { defineSoftureConfig, type SoftureConfig } from "@softure-ai/core";
import { getAuthorizationServerMetadata, resolveMcpOrigins } from "@softure-ai/mcp-access/server";
import { mcpAccess, MCP_RATE_LIMIT_BUCKETS } from "@softure-ai/mcp-access";
import { headerIp, security } from "@softure-ai/security";
import { z } from "zod";

export const APEX = "https://example.com";
export const APP = "https://app.example.com";

/** A server the way an app builds one for an anonymous client: a read tool and a write tool. */
export function createDemoServer(extraTools: readonly string[] = []): McpServer {
  const server = new McpServer({ name: "example", version: "2.4.0" });
  server.registerTool(
    "get_summary",
    { title: "Summary", description: "Reads the account's summary.\nSecond line.", annotations: { readOnlyHint: true } },
    () => ({ content: [{ type: "text", text: "account-42 balance" }] }),
  );
  server.registerTool("add_note", { description: "Adds a note.", inputSchema: z.object({ text: z.string() }) }, ({ text }) => ({
    content: [{ type: "text", text: `noted: ${text}` }],
  }));
  for (const name of extraTools) {
    server.registerTool(name, { description: `The ${name} tool.`, annotations: { readOnlyHint: true } }, () => ({ content: [{ type: "text", text: name }] }));
  }
  return server;
}

/** The smallest options an app writes. */
export const BASE_OPTIONS: AgentReadyOptionsInput = {
  name: "com.example/app",
  title: "Example",
  description: "Example tracks a person's notes.",
  provider: { organization: "Example Ltd" },
  mcp: { server: () => createDemoServer() },
};

export function createOptions(overrides: Partial<AgentReadyOptionsInput> = {}) {
  return agentReady({ ...BASE_OPTIONS, ...overrides }).options;
}

export function createContext(overrides: Partial<AgentReadyOptionsInput> = {}, origins: AgentOrigins = createOrigins(APP, APEX)): AgentDocumentContext {
  return { options: createOptions(overrides), origins };
}

/** An mcp-access config with OAuth on, extended by agent-ready the way the README says. */
export function createIssuerConfig(appOrigin = APP, extra: { resolveAppOrigin?: (request: { url: string; headers: { get(name: string): string | null } }) => string | null } = {}): SoftureConfig {
  return defineSoftureConfig({
    database: { url: "pglite://" },
    locale: "en",
    timezone: "Europe/Warsaw",
    appOrigin,
    modules: [
      security({ clientIp: headerIp("x-real-ip"), buckets: { ...MCP_RATE_LIMIT_BUCKETS } }),
      auth({}),
      mcpAccess({
        serverName: "example",
        resourceOrigins: [APEX],
        ...extra,
        oauth: {
          enabled: true,
          metadata: {
            authorizationServer: createAgentAuthExtension({ apexOrigin: APEX }),
            protectedResource: () => buildResourceDocumentation(APEX),
          },
        },
      }),
    ],
  });
}

/** The provider an app passes as `oauth.authorizationServerMetadata`: mcp-access's own builder. */
export function createIssuerProvider(config: SoftureConfig): (request: { url: string; headers: { get(name: string): string | null } }) => Readonly<Record<string, unknown>> {
  return (request) => getAuthorizationServerMetadata(config, resolveMcpOrigins(config, request));
}

/** A request as a proxy delivers it to a standalone server: the URL names the listening address. */
export function createRequest(path: string, host: string, proto = "https", init: RequestInit = {}): Request {
  const headers = new Headers(init.headers);
  headers.set("host", host);
  headers.set("x-forwarded-proto", proto);
  return new Request(`http://0.0.0.0:3000${path}`, { ...init, headers });
}

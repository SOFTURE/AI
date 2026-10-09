// Catalog parity: the tools listed in softure.config.ts (the token page shows them, agent docs read
// them) against the tools the app's MCP server really registers, for a read-only and a write identity.
// Framework-free: `expectToolCatalogMatchesServer` throws, so it works in any test runner.
import { createMcpHandler } from "@modelcontextprotocol/server";
import type { SoftureConfig } from "@softure-ai/core";
import type { McpServerIdentity } from "../contract.js";
import type { McpServerFactory } from "../server/endpoint.js";
import { getMcpAccessOptions } from "../server/options.js";

export interface ToolCatalogDifferences {
  /** Configured tools the server does not register for the identity that should get them. */
  readonly missing: readonly string[];
  /** Tools the server registers that the catalog does not list. */
  readonly unlisted: readonly string[];
  /** Configured write tools the server gives a read-only identity. */
  readonly writeForReaders: readonly string[];
}

const READER: McpServerIdentity = { userId: "00000000-0000-4000-8000-000000000001", canWrite: false, tokenId: "catalog-check" };
const WRITER: McpServerIdentity = { ...READER, canWrite: true };

/** Every difference between the configured catalog and the server, each list in the catalog's order, then the server's. */
export async function getToolCatalogDifferences(config: SoftureConfig, createServer: McpServerFactory): Promise<ToolCatalogDifferences> {
  const catalog = getMcpAccessOptions(config).tools;
  const forReaders = await listServerTools(createServer, READER);
  const forWriters = await listServerTools(createServer, WRITER);
  const listed = new Set(catalog.map((tool) => tool.name));
  return {
    missing: catalog.filter((tool) => !(tool.access === "read" ? forReaders.includes(tool.name) && forWriters.includes(tool.name) : forWriters.includes(tool.name))).map((tool) => tool.name),
    unlisted: [...new Set([...forReaders, ...forWriters])].filter((name) => !listed.has(name)),
    writeForReaders: catalog.filter((tool) => tool.access === "write" && forReaders.includes(tool.name)).map((tool) => tool.name),
  };
}

/** Throws a list of every difference, e.g. in a unit test next to the server. */
export async function expectToolCatalogMatchesServer(config: SoftureConfig, createServer: McpServerFactory): Promise<void> {
  const differences = await getToolCatalogDifferences(config, createServer);
  const problems = [
    differences.missing.length > 0 ? `missing from the server: ${differences.missing.join(", ")}` : null,
    differences.unlisted.length > 0 ? `registered but not in the catalog: ${differences.unlisted.join(", ")}` : null,
    differences.writeForReaders.length > 0 ? `write tools a read-only token gets: ${differences.writeForReaders.join(", ")}` : null,
  ].filter((problem) => problem !== null);
  if (problems.length > 0) {
    throw new Error(`@softure-ai/mcp-access: the tool catalog in softure.config.ts does not match the MCP server: ${problems.join("; ")}`);
  }
}

/** The tool names a fresh server lists for the identity, asked the way the endpoint serves it. */
async function listServerTools(createServer: McpServerFactory, identity: McpServerIdentity): Promise<string[]> {
  const handler = createMcpHandler(() => createServer(identity), { responseMode: "json" });
  const response = await handler.fetch(
    new Request("http://localhost/api/mcp", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
    }),
  );
  const answer = readAnswer(await response.text());
  if (answer.result?.tools === undefined) {
    throw new Error(`@softure-ai/mcp-access: listing the server's tools failed: ${typeof answer.error?.message === "string" ? answer.error.message : `HTTP ${String(response.status)}`}`);
  }
  return answer.result.tools.map((tool) => (typeof tool.name === "string" ? tool.name : "")).filter((name) => name !== "");
}

interface ToolsListAnswer {
  readonly result?: { readonly tools?: readonly { readonly name?: unknown }[] };
  readonly error?: { readonly message?: unknown };
}

/** The JSON-RPC answer, sent as JSON or as one SSE `message` event. */
function readAnswer(body: string): ToolsListAnswer {
  const data = body.startsWith("event:") ? (body.split("\n").find((line) => line.startsWith("data: "))?.slice("data: ".length) ?? "null") : body;
  return (JSON.parse(data) ?? {}) as ToolsListAnswer;
}

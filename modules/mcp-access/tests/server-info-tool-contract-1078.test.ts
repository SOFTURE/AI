// `get_server_info` answers the served tool contract (#1078): a hosted client may keep a stale `tools/list`, but it
// never caches a tool result, so the model reads each tool's current description and input schema in-band.
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import type { McpServerIdentity } from "@softure-ai/mcp-access";
import {
  createMcpServerFactory,
  describeToolList,
  listServedTools,
  registerServerInfoTool,
  SERVER_INFO_TOOL_NAME,
  type McpBuildInfo,
  type McpServerFactory,
  type ServerInfoToolOptions,
} from "@softure-ai/mcp-access/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";

const READER: McpServerIdentity = { userId: "00000000-0000-4000-8000-000000000002", canWrite: false, tokenId: "token-1" };
const WRITER: McpServerIdentity = { ...READER, canWrite: true };
const BUILD: McpBuildInfo = { release: "v1.4.0", commit: "abc1234", builtAt: "2026-10-29T10:00:00.000Z", startedAt: "2026-10-29T10:05:00.000Z" };
const TOOLS_HINT = "If your copy of a tool's schema or description differs from `tools` here, the server's is current: build calls from it.";

interface CallAnswer {
  readonly result?: { readonly content?: readonly { readonly text?: string }[]; readonly isError?: boolean; readonly serverInfo?: { readonly version: string } };
}

interface ContractAnswer {
  readonly server: { readonly version: string };
  readonly toolsHint: string;
  readonly tools: readonly { readonly name: string; readonly description?: string; readonly inputSchema: unknown }[];
  readonly toolNames?: readonly string[];
}

function registerNoteTools(server: McpServer, identity: McpServerIdentity): void {
  server.registerTool(
    "search_notes",
    { description: "Finds notes.", inputSchema: z.object({ query: z.string(), limit: z.number().int().max(50).optional() }) },
    () => ({ content: [] }),
  );
  if (identity.canWrite) server.registerTool("add_note", { description: "Adds a note.", inputSchema: z.object({ text: z.string() }) }, () => ({ content: [] }));
}

function createFactory(serverInfoTool: ServerInfoToolOptions, extra: { version?: string; strictToolInput?: boolean } = {}): McpServerFactory {
  return createMcpServerFactory({ name: "acme", registerTools: registerNoteTools, serverInfoTool, ...extra });
}

async function send(createServer: McpServerFactory, identity: McpServerIdentity, method: string, params: Record<string, unknown>): Promise<CallAnswer> {
  const handler = createMcpHandler(() => createServer(identity), { responseMode: "json" });
  const response = await handler.fetch(
    new Request("http://localhost/api/mcp", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    }),
  );
  const body = await response.text();
  const data = body.startsWith("event:") ? (body.split("\n").find((line) => line.startsWith("data: "))?.slice(6) ?? "null") : body;
  return JSON.parse(data) as CallAnswer;
}

async function readServedVersion(createServer: McpServerFactory, identity: McpServerIdentity): Promise<string> {
  const answer = await send(createServer, identity, "initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1.0.0" } });
  return answer.result?.serverInfo?.version ?? "";
}

async function callContract(createServer: McpServerFactory, identity: McpServerIdentity, args: Record<string, unknown> = {}): Promise<ContractAnswer> {
  const answer = await send(createServer, identity, "tools/call", { name: SERVER_INFO_TOOL_NAME, arguments: args });
  expect(answer.result?.isError).toBeUndefined();
  return JSON.parse(answer.result?.content?.[0]?.text ?? "null") as ContractAnswer;
}

describe("get_server_info with tools: true", () => {
  it.each([
    ["read", READER],
    ["write", WRITER],
  ])("answers every tool's description and input schema as tools/list does, for a %s token", async (_level, identity) => {
    const factory = createFactory({ buildInfo: () => BUILD, tools: true }, { strictToolInput: true });
    const listed = await listServedTools(() => factory(identity));

    const answer = await callContract(factory, identity);

    expect(answer.tools).toEqual(listed.map((tool) => ({ name: tool.name, description: tool.description, inputSchema: tool.inputSchema })));
    expect(answer.toolsHint).toBe(TOOLS_HINT);
    expect(answer.server.version).toBe(describeToolList(listed).toolListVersion);
    expect(answer.server.version).toBe(await readServedVersion(factory, identity));
  });

  it("answers the contract with a fixed version too", async () => {
    const answer = await callContract(createFactory({ buildInfo: () => BUILD, tools: true }, { version: "2.0.0" }), WRITER);

    expect(answer.server.version).toBe("2.0.0");
    expect(answer.tools.map((tool) => tool.name)).toEqual(["search_notes", "add_note", SERVER_INFO_TOOL_NAME]);
  });

  it("narrows the answer to the named tool", async () => {
    const answer = await callContract(createFactory({ buildInfo: () => BUILD, tools: true }), READER, { name: "search_notes" });

    expect(answer.tools).toHaveLength(1);
    expect(answer.tools[0]).toMatchObject({ name: "search_notes", description: "Finds notes." });
    expect(answer.tools[0]?.inputSchema).toMatchObject({ properties: { limit: { maximum: 50 } }, required: ["query"] });
    expect(answer.toolNames).toBeUndefined();
  });

  it("answers the served names for an unknown name, without a tool the caller's level does not get", async () => {
    const answer = await callContract(createFactory({ buildInfo: () => BUILD, tools: true }), READER, { name: "add_note" });

    expect(answer.tools).toEqual([]);
    expect(answer.toolNames).toEqual([SERVER_INFO_TOOL_NAME, "search_notes"]);
    expect(answer.toolsHint).toBe("No served tool has that name; `toolNames` lists every tool this server serves to you.");
  });

  it("carries no token or user identity", async () => {
    const text = JSON.stringify(await callContract(createFactory({ buildInfo: () => BUILD, tools: true }), WRITER));

    expect(text).not.toContain(WRITER.userId);
    expect(text).not.toContain(WRITER.tokenId);
  });

  it("takes an optional name input and describes the contract by default", async () => {
    const factory = createFactory({ buildInfo: () => BUILD, tools: true }, { strictToolInput: true });
    const [tool] = (await listServedTools(() => factory(READER))).filter((entry) => entry.name === SERVER_INFO_TOOL_NAME);

    expect(tool?.inputSchema).toMatchObject({ properties: { name: { type: "string" } } });
    expect((tool?.inputSchema as { required?: unknown }).required).toBeUndefined();
    expect(tool?.description).toContain("current description and input schema of every tool");
  });

  it("keeps the empty input and the version when the option is off", async () => {
    const plain = createFactory({ buildInfo: () => BUILD });
    const withContract = createFactory({ buildInfo: () => BUILD, tools: true });
    const [tool] = (await listServedTools(() => plain(READER))).filter((entry) => entry.name === SERVER_INFO_TOOL_NAME);
    const answer = await callContract(plain, READER);

    expect(tool?.inputSchema).toMatchObject({ properties: {} });
    expect(answer).not.toHaveProperty("tools");
    expect(answer).not.toHaveProperty("toolsHint");
    expect(await readServedVersion(withContract, READER)).not.toBe(await readServedVersion(plain, READER));
  });

  it("registers on a hand-built server that lists itself", async () => {
    const createServer: McpServerFactory = () => {
      const server = new McpServer({ name: "notes", version: "3.1.0" });
      registerNoteTools(server, READER);
      registerServerInfoTool(server, { buildInfo: () => BUILD, tools: true, server: { name: "notes", version: "3.1.0" }, servedTools: () => listServedTools(() => createServer(READER)) });
      return server;
    };

    const answer = await callContract(createServer, READER);

    expect(answer.tools.map((tool) => tool.name)).toEqual(["search_notes", SERVER_INFO_TOOL_NAME]);
  });

  it("refuses to register with tools on and nothing to list them", () => {
    expect(() => registerServerInfoTool(new McpServer({ name: "notes", version: "1.0.0" }), { buildInfo: () => BUILD, tools: true, server: { name: "notes", version: "1.0.0" } })).toThrow(
      "get_server_info with tools: true needs servedTools",
    );
  });
});

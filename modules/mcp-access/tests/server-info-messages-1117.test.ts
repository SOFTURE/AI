// `get_server_info` takes its strings from the app's messages (#1117): the description, the `name` input description
// and the `toolsHint` / `unknownToolHint` answers follow the config's locale and overrides, else the English dictionary.
import type { McpServerIdentity } from "@softure-ai/mcp-access";
import { createMcpServerFactory, listServedTools, SERVER_INFO_TOOL_NAME, type McpServerFactory, type ServerInfoToolOptions } from "@softure-ai/mcp-access/server";
import { mcpAccessMessages } from "@softure-ai/mcp-access";
import { createMcpHandler, type McpServer } from "@modelcontextprotocol/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createConfig, OPTIONS } from "./support.js";

const READER: McpServerIdentity = { userId: "00000000-0000-4000-8000-000000000002", canWrite: false, tokenId: "token-1" };
const BUILD = { release: "v1.4.0", commit: "abc1234", builtAt: "2026-10-29T10:00:00.000Z", startedAt: "2026-10-29T10:05:00.000Z" };
const APP_TEXTS = {
  description: "App: which build answers.",
  descriptionWithTools: "App: which build answers, and every tool's contract.",
  nameInputDescription: "App: one tool's name.",
  toolsHint: "App: the server's copy wins.",
  unknownToolHint: "App: no such tool.",
};
const EN = mcpAccessMessages.en.serverInfoTool;

interface ListedTool {
  readonly name: string;
  readonly description?: string;
  readonly inputSchema?: { readonly properties?: Readonly<Record<string, { readonly description?: string }>> };
}

interface ContractAnswer {
  readonly toolsHint: string;
}

function registerNoteTools(server: McpServer): void {
  server.registerTool("search_notes", { description: "Finds notes.", inputSchema: z.object({ query: z.string() }) }, () => ({ content: [] }));
}

function createFactory(serverInfoTool: ServerInfoToolOptions): McpServerFactory {
  return createMcpServerFactory({ name: "acme", registerTools: registerNoteTools, serverInfoTool });
}

async function readServerInfoTool(factory: McpServerFactory): Promise<ListedTool | undefined> {
  const listed = (await listServedTools(() => factory(READER))) as readonly ListedTool[];
  return listed.find((tool) => tool.name === SERVER_INFO_TOOL_NAME);
}

async function callServerInfo(factory: McpServerFactory, args: Record<string, unknown>): Promise<ContractAnswer> {
  const handler = createMcpHandler(() => factory(READER), { responseMode: "json" });
  const response = await handler.fetch(
    new Request("http://localhost/api/mcp", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: SERVER_INFO_TOOL_NAME, arguments: args } }),
    }),
  );
  const body = await response.text();
  const data = body.startsWith("event:") ? (body.split("\n").find((line) => line.startsWith("data: "))?.slice(6) ?? "null") : body;
  const answer = JSON.parse(data) as { result?: { content?: readonly { text?: string }[] } };
  return JSON.parse(answer.result?.content?.[0]?.text ?? "null") as ContractAnswer;
}

describe("get_server_info messages", () => {
  it("takes the description, the name input description and both hints from the app's messages", async () => {
    const config = createConfig({ ...OPTIONS, messages: { en: { serverInfoTool: APP_TEXTS } } });
    const factory = createFactory({ buildInfo: () => BUILD, tools: true, config });

    const tool = await readServerInfoTool(factory);

    expect(tool?.description).toBe(APP_TEXTS.descriptionWithTools);
    expect(tool?.inputSchema?.properties?.name?.description).toBe(APP_TEXTS.nameInputDescription);
    expect((await callServerInfo(factory, {})).toolsHint).toBe(APP_TEXTS.toolsHint);
    expect((await callServerInfo(factory, { name: "missing_tool" })).toolsHint).toBe(APP_TEXTS.unknownToolHint);
  });

  it("takes the description without tools from the app's messages", async () => {
    const config = createConfig({ ...OPTIONS, messages: { en: { serverInfoTool: APP_TEXTS } } });

    expect((await readServerInfoTool(createFactory({ buildInfo: () => BUILD, config })))?.description).toBe(APP_TEXTS.description);
  });

  it("reads the dictionary of the config's locale", async () => {
    const config = createConfig({ ...OPTIONS, messages: { pl: { serverInfoTool: APP_TEXTS } } }, "pl");
    const factory = createFactory({ buildInfo: () => BUILD, tools: true, config });

    expect((await readServerInfoTool(factory))?.description).toBe(APP_TEXTS.descriptionWithTools);
    expect((await callServerInfo(factory, {})).toolsHint).toBe(APP_TEXTS.toolsHint);
  });

  it("keeps the English text for a key the app does not override", async () => {
    const config = createConfig({ ...OPTIONS, messages: { en: { serverInfoTool: { toolsHint: APP_TEXTS.toolsHint } } } });
    const factory = createFactory({ buildInfo: () => BUILD, tools: true, config });

    expect((await readServerInfoTool(factory))?.description).toBe(EN.descriptionWithTools);
    expect((await callServerInfo(factory, { name: "missing_tool" })).toolsHint).toBe(EN.unknownToolHint);
  });

  it("answers the English dictionary without a config", async () => {
    const factory = createFactory({ buildInfo: () => BUILD, tools: true });

    expect((await readServerInfoTool(factory))?.inputSchema?.properties?.name?.description).toBe(EN.nameInputDescription);
    expect((await callServerInfo(factory, {})).toolsHint).toBe(EN.toolsHint);
  });

  it("prefers an explicit description over the messages", async () => {
    const config = createConfig({ ...OPTIONS, messages: { en: { serverInfoTool: APP_TEXTS } } });

    expect((await readServerInfoTool(createFactory({ buildInfo: () => BUILD, tools: true, config, description: "Own." })))?.description).toBe("Own.");
  });
});

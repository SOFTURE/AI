// The `get_server_info` tool (#885): one call tells an assistant which build answers, with the version the server
// served at `initialize`, so a "done" can be checked against production.
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import type { McpServerIdentity } from "@softure-ai/mcp-access";
import {
  createMcpServerFactory,
  listServedTools,
  registerServerInfoTool,
  SERVER_INFO_TOOL_NAME,
  type McpBuildInfo,
  type McpServerFactory,
  type ServerInfoToolOptions,
} from "@softure-ai/mcp-access/server";
import { readBuildInfo } from "@softure-ai/ops/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const READER: McpServerIdentity = { userId: "00000000-0000-4000-8000-000000000002", canWrite: false, tokenId: "token-1" };
const WRITER: McpServerIdentity = { ...READER, canWrite: true };
const BUILD: McpBuildInfo = { release: "v1.4.0", commit: "abc1234", builtAt: "2026-10-29T10:00:00.000Z", startedAt: "2026-10-29T10:05:00.000Z" };

interface CallAnswer {
  readonly result?: { readonly content?: readonly { readonly text?: string }[]; readonly isError?: boolean; readonly serverInfo?: { readonly version: string } };
  readonly error?: { readonly message?: string };
}

function registerNoteTools(server: McpServer, identity: McpServerIdentity): void {
  server.registerTool("search_notes", { description: "Finds notes.", inputSchema: z.object({ query: z.string() }) }, () => ({ content: [] }));
  if (identity.canWrite) server.registerTool("add_note", { description: "Adds a note.", inputSchema: z.object({ text: z.string() }) }, () => ({ content: [] }));
}

function createFactory(serverInfoTool?: ServerInfoToolOptions, extra: { version?: string; strictToolInput?: boolean } = {}): McpServerFactory {
  return createMcpServerFactory({ name: "acme", registerTools: registerNoteTools, ...(serverInfoTool === undefined ? {} : { serverInfoTool }), ...extra });
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
  if (answer.result?.serverInfo === undefined) throw new Error("initialize gave no serverInfo");
  return answer.result.serverInfo.version;
}

async function callServerInfo(createServer: McpServerFactory, identity: McpServerIdentity, args: Record<string, unknown> = {}): Promise<CallAnswer> {
  return send(createServer, identity, "tools/call", { name: SERVER_INFO_TOOL_NAME, arguments: args });
}

function readJson(answer: CallAnswer): unknown {
  return JSON.parse(answer.result?.content?.[0]?.text ?? "null");
}

async function listNames(createServer: McpServerFactory, identity: McpServerIdentity): Promise<string[]> {
  return (await listServedTools(() => createServer(identity))).map((tool) => tool.name).sort();
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("get_server_info", () => {
  it("is listed only when the factory opts in, for read and write tokens alike", async () => {
    const plain = createFactory();
    const withInfo = createFactory({ buildInfo: () => BUILD });

    expect(await listNames(plain, READER)).toEqual(["search_notes"]);
    expect(await listNames(withInfo, READER)).toEqual(["get_server_info", "search_notes"]);
    expect(await listNames(withInfo, WRITER)).toEqual(["add_note", "get_server_info", "search_notes"]);
  });

  it("is read only, takes no input and describes itself from the dictionary", async () => {
    const [tool] = (await listServedTools(() => createFactory({ buildInfo: () => BUILD })(READER))).filter((entry) => entry.name === SERVER_INFO_TOOL_NAME);

    expect(tool?.annotations).toEqual({ readOnlyHint: true, idempotentHint: true, openWorldHint: false });
    expect(tool?.description).toContain("check that a change is live");
  });

  it("answers the build info with the name and the version the server served at initialize", async () => {
    const factory = createFactory({ buildInfo: () => BUILD });
    const version = await readServedVersion(factory, WRITER);

    const answer = await callServerInfo(factory, WRITER);

    expect(answer.result?.isError).toBeUndefined();
    expect(readJson(answer)).toEqual({ server: { name: "acme", version }, ...BUILD });
    expect(version).toMatch(/^1\.0\.0-tools-[0-9a-f]{12}$/);
  });

  it("reports the version of the caller's access level", async () => {
    const factory = createFactory({ buildInfo: () => BUILD });

    const read = readJson(await callServerInfo(factory, READER)) as { server: { version: string } };
    const write = readJson(await callServerInfo(factory, WRITER)) as { server: { version: string } };

    expect(read.server.version).toBe(await readServedVersion(factory, READER));
    expect(write.server.version).toBe(await readServedVersion(factory, WRITER));
    expect(read.server.version).not.toBe(write.server.version);
  });

  it("reports a fixed version when the factory serves one", async () => {
    const answer = readJson(await callServerInfo(createFactory({ buildInfo: () => BUILD }, { version: "2.0.0" }), READER));

    expect(answer).toMatchObject({ server: { name: "acme", version: "2.0.0" } });
  });

  it("is part of the measured tool list, so turning it on changes the version", async () => {
    const before = await readServedVersion(createFactory(), READER);
    const after = await readServedVersion(createFactory({ buildInfo: () => BUILD }), READER);

    expect(after).not.toBe(before);
  });

  it("answers the build info ops reads, passed as readBuildInfo", async () => {
    vi.stubEnv("SOFTURE_RELEASE", "v2.0.1");
    vi.stubEnv("SOFTURE_BUILD_COMMIT", "def5678");
    vi.stubEnv("SOFTURE_BUILD_TIME", "2026-10-29T12:00:00.000Z");
    const startedAt = new Date("2026-10-29T12:01:00.000Z");
    try {
      const answer = readJson(await callServerInfo(createFactory({ buildInfo: () => readBuildInfo({ startedAt }) }), READER));

      expect(answer).toMatchObject({ release: "v2.0.1", commit: "def5678", builtAt: "2026-10-29T12:00:00.000Z", startedAt: "2026-10-29T12:01:00.000Z" });
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("adds the changelog when the app passes a provider, and null when the provider fails", async () => {
    const changelog = [{ version: "v1.4.0", notes: ["Notes can be pinned."] }];
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const withChangelog = readJson(await callServerInfo(createFactory({ buildInfo: () => BUILD, changelog: () => changelog }), READER));
    const failing = readJson(
      await callServerInfo(
        createFactory({
          buildInfo: () => BUILD,
          changelog: () => {
            throw new TypeError("changelog.json is missing");
          },
        }),
        READER,
      ),
    );

    expect(withChangelog).toMatchObject({ ...BUILD, changelog });
    expect(failing).toMatchObject({ ...BUILD, changelog: null });
    expect(errorLog).toHaveBeenCalledTimes(1);
    expect(String(errorLog.mock.calls[0]?.[0])).not.toContain("changelog.json is missing");
  });

  it("answers a tool error when the build info cannot be read", async () => {
    const answer = await callServerInfo(
      createFactory({
        buildInfo: () => {
          throw new Error("no build info");
        },
      }),
      READER,
    );

    expect(answer.result?.isError).toBe(true);
  });

  it("refuses an unknown field when the factory makes input strict", async () => {
    const answer = await callServerInfo(createFactory({ buildInfo: () => BUILD }, { strictToolInput: true }), READER, { verbose: true });

    expect(answer.result?.isError).toBe(true);
    expect(answer.result?.content?.[0]?.text).toBe('Input validation error: Invalid arguments for tool get_server_info: Unknown fields: "verbose". Accepted fields: none.');
  });

  it("registers on a hand-built server with the name and version given", async () => {
    const createServer: McpServerFactory = () => {
      const server = new McpServer({ name: "notes", version: "3.1.0" });
      registerServerInfoTool(server, { buildInfo: () => BUILD, description: "Which build answers.", server: { name: "notes", version: "3.1.0" } });
      return server;
    };

    const [tool] = await listServedTools(() => createServer(READER));
    const answer = readJson(await callServerInfo(createServer, READER));

    expect(tool?.description).toBe("Which build answers.");
    expect(answer).toEqual({ server: { name: "notes", version: "3.1.0" }, ...BUILD });
  });
});

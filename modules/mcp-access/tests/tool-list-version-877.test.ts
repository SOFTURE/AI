// The server version that follows the tool list (#877): a client drops its cached `tools/list` only when
// the version it reads at `initialize` changes, so the version is a fingerprint of the list per access level.
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import type { McpServerIdentity } from "@softure-ai/mcp-access";
import { createMcpServerFactory, measureToolList, type McpServerFactory } from "@softure-ai/mcp-access/server";
import { measureServedToolLists } from "@softure-ai/mcp-access/testing";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createDemoServer } from "./support.js";

const VERSION_SHAPE = /^1\.0\.0-tools-[0-9a-f]{12}$/;
const READER: McpServerIdentity = { userId: "00000000-0000-4000-8000-000000000002", canWrite: false, tokenId: "token-1" };
const WRITER: McpServerIdentity = { ...READER, canWrite: true };

interface NoteToolsVariant {
  readonly description?: string;
  readonly noteField?: string;
  readonly searchName?: string;
  readonly reversed?: boolean;
}

/** Two tools whose description, input field and name each test can change. */
function registerNoteTools(server: McpServer, variant: NoteToolsVariant = {}): void {
  const registrations = [
    () => server.registerTool("add_note", { description: variant.description ?? "Adds a note.", inputSchema: z.object({ [variant.noteField ?? "text"]: z.string() }) }, () => ({ content: [] })),
    () => server.registerTool(variant.searchName ?? "search_notes", { description: "Finds notes.", inputSchema: z.object({ query: z.string() }) }, () => ({ content: [] })),
  ];
  for (const register of variant.reversed === true ? registrations.reverse() : registrations) register();
}

/** The demo server's tools: `whoami` for everyone, `add_note` for a token that can write. */
function registerDemoTools(server: McpServer, identity: McpServerIdentity): void {
  server.registerTool("whoami", { description: "Says whose account this is." }, () => ({ content: [] }));
  if (identity.canWrite) {
    server.registerTool("add_note", { description: "Adds a note.", inputSchema: z.object({ text: z.string() }) }, () => ({ content: [] }));
  }
}

/** The `serverInfo` a client reads from `initialize`, asked the way the endpoint serves it. */
async function readServerInfo(createServer: McpServerFactory, identity: McpServerIdentity): Promise<{ name: string; version: string; title?: string }> {
  const handler = createMcpHandler(() => createServer(identity), { responseMode: "json" });
  const response = await handler.fetch(
    new Request("http://localhost/api/mcp", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1.0.0" } },
      }),
    }),
  );
  const body = await response.text();
  const data = body.startsWith("event:") ? (body.split("\n").find((line) => line.startsWith("data: "))?.slice(6) ?? "null") : body;
  const answer = JSON.parse(data) as { result?: { serverInfo?: { name: string; version: string; title?: string } } };
  if (answer.result?.serverInfo === undefined) throw new Error(`initialize gave no serverInfo: ${body}`);
  return answer.result.serverInfo;
}

describe("measureToolList", () => {
  it("gives the same version and count for the same registrations", async () => {
    const first = await measureToolList((server) => registerNoteTools(server));
    const second = await measureToolList((server) => registerNoteTools(server));

    expect(first.toolListVersion).toMatch(VERSION_SHAPE);
    expect(second).toEqual(first);
    expect(first.toolCount).toBe(2);
  });

  it("changes the version when a description, an input field or a name changes", async () => {
    const base = await measureToolList((server) => registerNoteTools(server));
    const versions = await Promise.all([
      measureToolList((server) => registerNoteTools(server, { description: "Adds a note to the inbox." })),
      measureToolList((server) => registerNoteTools(server, { noteField: "note" })),
      measureToolList((server) => registerNoteTools(server, { searchName: "find_notes" })),
    ]);

    const distinct = new Set([base, ...versions].map((measured) => measured.toolListVersion));
    expect(distinct.size).toBe(4);
  });

  it("keeps the version when only the order of registration changes", async () => {
    const forward = await measureToolList((server) => registerNoteTools(server));
    const reversed = await measureToolList((server) => registerNoteTools(server, { reversed: true }));

    expect(reversed.toolListVersion).toBe(forward.toolListVersion);
  });

  it("puts the given release before the fingerprint", async () => {
    const base = await measureToolList((server) => registerNoteTools(server));
    const released = await measureToolList((server) => registerNoteTools(server), { release: "2.4.1" });

    expect(released.toolListVersion).toBe(base.toolListVersion.replace("1.0.0", "2.4.1"));
  });

  it("measures a server with no tools as zero tools", async () => {
    const measured = await measureToolList(() => undefined);

    expect(measured.toolListVersion).toMatch(VERSION_SHAPE);
    expect(measured.toolCount).toBe(0);
  });

  it("refuses a release that is not MAJOR.MINOR.PATCH", async () => {
    await expect(measureToolList((server) => registerNoteTools(server), { release: "1.0" })).rejects.toThrow(
      '@softure-ai/mcp-access: the tool list release must be MAJOR.MINOR.PATCH, got "1.0"',
    );
  });
});

describe("createMcpServerFactory", () => {
  it("answers initialize with the measured version of the identity's access level", async () => {
    const createServer = createMcpServerFactory({ name: "acme", title: "Acme", registerTools: registerDemoTools });
    const forReaders = await measureToolList((server) => registerDemoTools(server, READER));
    const forWriters = await measureToolList((server) => registerDemoTools(server, WRITER));

    expect(await readServerInfo(createServer, READER)).toEqual({ name: "acme", title: "Acme", version: forReaders.toolListVersion });
    expect(await readServerInfo(createServer, WRITER)).toEqual({ name: "acme", title: "Acme", version: forWriters.toolListVersion });
    expect(forReaders.toolListVersion).not.toBe(forWriters.toolListVersion);
  });

  it("measures each access level once and registers the tools again for every request", async () => {
    const registerTools = vi.fn(registerDemoTools);
    const createServer = createMcpServerFactory({ name: "acme", registerTools });

    await Promise.all([createServer(READER), createServer(READER), createServer({ ...READER, userId: "00000000-0000-4000-8000-000000000003" })]);
    await createServer(WRITER);

    // One measurement per level (2) plus one registration per served request (4).
    expect(registerTools).toHaveBeenCalledTimes(6);
  });

  it("measures again after a failed measurement", async () => {
    let calls = 0;
    const createServer = createMcpServerFactory({
      name: "acme",
      registerTools: (server, identity) => {
        calls += 1;
        if (calls === 1) throw new Error("registration failed");
        registerDemoTools(server, identity);
      },
    });

    await expect(createServer(READER)).rejects.toThrow("registration failed");
    const server = await createServer(READER);

    expect(server).toBeInstanceOf(McpServer);
    expect(calls).toBe(3);
  });

  it("serves a fixed version instead of the measured one", async () => {
    const registerTools = vi.fn(registerDemoTools);
    const createServer = createMcpServerFactory({ name: "acme", version: "3.0.0", registerTools });

    expect((await readServerInfo(createServer, READER)).version).toBe("3.0.0");
    expect(registerTools).toHaveBeenCalledTimes(1);
  });

  it("uses the release part for the measured version", async () => {
    const createServer = createMcpServerFactory({ name: "acme", release: "0.7.2", registerTools: registerDemoTools });

    expect((await readServerInfo(createServer, READER)).version).toMatch(/^0\.7\.2-tools-[0-9a-f]{12}$/);
  });
});

describe("measureServedToolLists", () => {
  it("reports the version and count a hand-written factory's tool list gives each access level", async () => {
    const measured = await measureServedToolLists(createDemoServer);

    expect(measured.read.toolCount).toBe(1);
    expect(measured.write.toolCount).toBe(2);
    expect(measured.read.toolListVersion).toMatch(VERSION_SHAPE);
    expect(measured.write.toolListVersion).not.toBe(measured.read.toolListVersion);
  });

  it("matches what the factory serves", async () => {
    const createServer = createMcpServerFactory({ name: "acme", release: "1.2.3", registerTools: registerDemoTools });
    const measured = await measureServedToolLists(createServer, "1.2.3");

    expect((await readServerInfo(createServer, READER)).version).toBe(measured.read.toolListVersion);
    expect((await readServerInfo(createServer, WRITER)).version).toBe(measured.write.toolListVersion);
  });
});


// Request diagnostics (#1066): an opt-in entry per request with the JSON-RPC method, the tool name, the session state,
// the served tool list version, the status and the client's `clientInfo` on `initialize`, and never a token, body,
// argument value, session id or user identity.
import { createMcpEndpoint, createMcpServerFactory, issueAccessToken, type McpRequestDiagnostic } from "@softure-ai/mcp-access/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { callTool, createMcpRequest, createTestMcp, createUser, listTools, type TestMcp } from "./support.js";

const INITIALIZE = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "claude-ai", version: "0.1.0" } },
};
const SECRET_ARGUMENT = "a-private-note-text";

function createFactory(description: string) {
  return createMcpServerFactory({
    name: "acme",
    registerTools: (server) => {
      server.registerTool("whoami", { description }, () => ({ content: [{ type: "text", text: "you" }] }));
      server.registerTool("add_note", { description: "Adds a note.", inputSchema: z.object({ text: z.string() }) }, () => ({ content: [{ type: "text", text: "noted" }] }));
    },
  });
}

describe("request diagnostics", () => {
  let test: TestMcp;
  let alice: string;
  let token: string;
  let entries: McpRequestDiagnostic[];

  beforeEach(async () => {
    test = await createTestMcp();
    alice = await createUser(test.database, "alice@example.com");
    const issued = await issueAccessToken(test.ctx, { userId: alice, name: "Laptop", canWrite: false });
    if (!issued.ok) throw new Error(`issue failed: ${issued.error}`);
    token = issued.value.token;
    entries = [];
  });
  afterEach(async () => {
    await test.database.close();
    vi.restoreAllMocks();
  });

  function request(body: unknown, headers: Record<string, string> = {}, authorization: string | undefined = undefined): Request {
    const base = createMcpRequest(body, authorization === undefined ? { token } : { authorization });
    const merged = new Headers(base.headers);
    for (const [name, value] of Object.entries(headers)) merged.set(name, value);
    return new Request(base, { headers: merged });
  }

  function endpointFor(description = "Says whose account this is.") {
    return createMcpEndpoint({ createServer: createFactory(description), diagnostics: (entry) => entries.push(entry) });
  }

  async function openSession(endpoint: ReturnType<typeof createMcpEndpoint>): Promise<{ sessionId: string; version: string }> {
    const response = await endpoint(test.ctx, request(INITIALIZE));
    const sessionId = response.headers.get("mcp-session-id");
    const version = entries.at(-1)?.toolListVersion;
    if (sessionId === null || version === undefined || version === null) throw new Error("initialize issued no session");
    return { sessionId, version };
  }

  it("records an initialize with the client, the protocol version, the served version and the issued session", async () => {
    const endpoint = endpointFor();
    const response = await endpoint(test.ctx, request(INITIALIZE));
    expect(response.status).toBe(200);
    expect(entries).toEqual([
      {
        httpMethod: "POST",
        method: "initialize",
        tool: null,
        session: "none",
        sessionVersion: null,
        toolListVersion: expect.stringMatching(/^1\.0\.0-tools-[0-9a-f]{12}$/) as unknown,
        sessionIssued: true,
        status: 200,
        client: { name: "claude-ai", version: "0.1.0" },
        protocolVersion: "2025-06-18",
      },
    ]);
  });

  it("records a tools/list in a current session", async () => {
    const endpoint = endpointFor();
    const { sessionId, version } = await openSession(endpoint);
    await endpoint(test.ctx, request(listTools(2), { "mcp-session-id": sessionId, "mcp-protocol-version": "2025-06-18" }));
    expect(entries.at(-1)).toEqual({
      httpMethod: "POST",
      method: "tools/list",
      tool: null,
      session: "current",
      sessionVersion: null,
      toolListVersion: version,
      sessionIssued: false,
      status: 200,
      client: null,
      protocolVersion: "2025-06-18",
    });
  });

  it("records a request in a stale session with the version the session carries", async () => {
    const { sessionId, version: oldVersion } = await openSession(endpointFor("Old text."));
    const endpoint = endpointFor("New text.");
    const response = await endpoint(test.ctx, request(listTools(2), { "mcp-session-id": sessionId }));
    expect(response.status).toBe(404);
    const entry = entries.at(-1);
    expect(entry).toMatchObject({ method: "tools/list", session: "stale", sessionVersion: oldVersion, status: 404, sessionIssued: false });
    expect(entry?.toolListVersion).not.toBe(oldVersion);
  });

  it("records a session id the endpoint never issued", async () => {
    const endpoint = endpointFor();
    const response = await endpoint(test.ctx, request(listTools(2), { "mcp-session-id": "not-ours" }));
    expect(response.status).toBe(404);
    expect(entries.at(-1)).toMatchObject({ method: "tools/list", session: "not_issued", sessionVersion: null, status: 404 });
  });

  it("records a request with no session", async () => {
    const endpoint = endpointFor();
    const response = await endpoint(test.ctx, request(listTools(2)));
    expect(response.status).toBe(200);
    expect(entries).toEqual([
      {
        httpMethod: "POST",
        method: "tools/list",
        tool: null,
        session: "none",
        sessionVersion: null,
        toolListVersion: null,
        sessionIssued: false,
        status: 200,
        client: null,
        protocolVersion: null,
      },
    ]);
  });

  it("records a tools/call by tool name, without its arguments, the token or the session id", async () => {
    const endpoint = endpointFor();
    const { sessionId } = await openSession(endpoint);
    await endpoint(test.ctx, request(callTool("add_note", { text: SECRET_ARGUMENT }, 3), { "mcp-session-id": sessionId }));
    expect(entries.at(-1)).toMatchObject({ method: "tools/call", tool: "add_note", session: "current", status: 200 });
    const logged = JSON.stringify(entries);
    expect(logged).not.toContain(SECRET_ARGUMENT);
    expect(logged).not.toContain(token);
    expect(logged).not.toContain(sessionId);
    expect(logged).not.toContain(alice);
  });

  it("records a request refused at authentication with its status and without the token", async () => {
    const endpoint = endpointFor();
    const response = await endpoint(test.ctx, request(listTools(2), {}, "Bearer guessed-token-value"));
    expect(response.status).toBe(401);
    expect(entries).toEqual([
      {
        httpMethod: "POST",
        method: "tools/list",
        tool: null,
        session: "none",
        sessionVersion: null,
        toolListVersion: null,
        sessionIssued: false,
        status: 401,
        client: null,
        protocolVersion: null,
      },
    ]);
    expect(JSON.stringify(entries)).not.toContain("guessed-token-value");
  });

  it("cuts client text and replaces control characters", async () => {
    const endpoint = endpointFor();
    const name = `evil\nclient${"x".repeat(200)}`;
    await endpoint(test.ctx, request({ ...INITIALIZE, params: { ...INITIALIZE.params, clientInfo: { name, version: "1" } } }));
    expect(entries.at(-1)?.client?.name).toBe(`evil?client${"x".repeat(117)}…`);
  });

  it("writes one console.info line when turned on with true", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const endpoint = createMcpEndpoint({ createServer: createFactory("Says whose account this is."), diagnostics: true });
    await endpoint(test.ctx, request(listTools(2)));
    expect(info).toHaveBeenCalledTimes(1);
    expect(info.mock.calls[0]?.[0]).toBe(
      '@softure-ai/mcp-access: mcp request {"httpMethod":"POST","method":"tools/list","tool":null,"session":"none","sessionVersion":null,"toolListVersion":null,"sessionIssued":false,"status":200,"client":null,"protocolVersion":null}',
    );
  });

  it("logs nothing by default", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const endpoint = createMcpEndpoint({ createServer: createFactory("Says whose account this is.") });
    await endpoint(test.ctx, request(INITIALIZE));
    expect(info).not.toHaveBeenCalled();
  });

  it("serves the request when the sink throws, and logs the failure", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const endpoint = createMcpEndpoint({
      createServer: createFactory("Says whose account this is."),
      diagnostics: () => {
        throw new Error("sink down");
      },
    });
    const response = await endpoint(test.ctx, request(listTools(2)));
    expect(response.status).toBe(200);
    expect(error).toHaveBeenCalledWith(expect.stringContaining("@softure-ai/mcp-access: the request diagnostics sink failed"));
  });
});

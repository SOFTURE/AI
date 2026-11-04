// Sessions tied to the tool list version (#1055): `initialize` issues a session id that carries the version of the
// identity's access level, a request in a session from another version answers 404 so the client initializes and
// lists the tools again, and a client without a session id is served as before.
import { createMcpEndpoint, createMcpServerFactory, createToolListSessionId, issueAccessToken, readToolListSessionVersion } from "@softure-ai/mcp-access/server";
import { expectToolListSessionRenewed } from "@softure-ai/mcp-access/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { callTool, createDemoServer, createMcpRequest, createTestMcp, createUser, listTools, type TestMcp } from "./support.js";

const INITIALIZE = { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "client", version: "1.0.0" } } };

interface InitializeAnswer {
  readonly result?: { readonly capabilities?: { readonly tools?: { readonly listChanged?: boolean } }; readonly serverInfo?: { readonly version?: string } };
  readonly error?: { readonly code?: number; readonly message?: string };
}

/** The JSON-RPC answer of a response, sent as JSON or as one SSE `message` event. */
async function readAnswer(response: Response): Promise<InitializeAnswer & { readonly result?: { readonly tools?: { readonly name: string }[] } }> {
  const body = await response.text();
  const data = body.startsWith("event:") ? body.split("\n").find((line) => line.startsWith("data: "))?.slice(6) : body;
  return JSON.parse(data ?? "null") as InitializeAnswer;
}

/** A factory whose `whoami` description is `description`, so a "release" changes the tool list. */
function createFactory(description: string) {
  return createMcpServerFactory({
    name: "acme",
    registerTools: (server, identity) => {
      server.registerTool("whoami", { description }, () => ({ content: [{ type: "text", text: identity.userId }] }));
      if (identity.canWrite) server.registerTool("add_note", { description: "Adds a note.", inputSchema: z.object({ text: z.string() }) }, () => ({ content: [{ type: "text", text: "noted" }] }));
    },
  });
}

describe("sessions tied to the tool list version", () => {
  let test: TestMcp;
  let alice: string;

  beforeEach(async () => {
    test = await createTestMcp();
    alice = await createUser(test.database, "alice@example.com");
  });
  afterEach(async () => {
    await test.database.close();
    vi.restoreAllMocks();
  });

  async function issue(canWrite: boolean): Promise<string> {
    const result = await issueAccessToken(test.ctx, { userId: alice, name: "Laptop", canWrite });
    if (!result.ok) throw new Error(`issue failed: ${result.error}`);
    return result.value.token;
  }

  function request(body: unknown, token: string, headers: Record<string, string> = {}): Request {
    const base = createMcpRequest(body, { token });
    const merged = new Headers(base.headers);
    for (const [name, value] of Object.entries(headers)) merged.set(name, value);
    return new Request(base, { headers: merged });
  }

  async function initialize(endpoint: ReturnType<typeof createMcpEndpoint>, token: string, headers: Record<string, string> = {}) {
    const response = await endpoint(test.ctx, request(INITIALIZE, token, headers));
    return { response, sessionId: response.headers.get("mcp-session-id"), answer: await readAnswer(response) };
  }

  it("answers initialize with a session id that carries the served version, and declares no list_changed", async () => {
    const endpoint = createMcpEndpoint({ createServer: createFactory("Says whose account this is.") });
    const { response, sessionId, answer } = await initialize(endpoint, await issue(false));
    expect(response.status).toBe(200);
    expect(sessionId).toMatch(/^[A-Za-z0-9_-]+\.[0-9a-f]{32}$/);
    expect(readToolListSessionVersion(sessionId ?? "")).toBe(answer.result?.serverInfo?.version);
    expect(answer.result?.serverInfo?.version).toMatch(/^1\.0\.0-tools-[0-9a-f]{12}$/);
    expect(answer.result?.capabilities?.tools?.listChanged).toBe(false);
  });

  it("keeps an SSE initialize answer an SSE event", async () => {
    const endpoint = createMcpEndpoint({ createServer: createFactory("Says whose account this is.") });
    const { response, sessionId, answer } = await initialize(endpoint, await issue(false), { accept: "application/json, text/event-stream" });
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(sessionId).not.toBeNull();
    expect(answer.result?.capabilities?.tools?.listChanged).toBe(false);
    expect(response.headers.get("content-length")).toBeNull();
  });

  it("passes a refused initialize through untouched, with no session id", async () => {
    const endpoint = createMcpEndpoint({ createServer: createFactory("Says whose account this is.") });
    // The SDK refuses a 2025-era client that does not accept an event stream.
    const { response, sessionId } = await initialize(endpoint, await issue(false), { accept: "application/json" });
    expect(response.status).toBe(406);
    expect(sessionId).toBeNull();
  });

  it("serves a request in a session of the current version", async () => {
    const endpoint = createMcpEndpoint({ createServer: createFactory("Says whose account this is.") });
    const token = await issue(true);
    const { sessionId } = await initialize(endpoint, token);
    const response = await endpoint(test.ctx, request(listTools(), token, { "mcp-session-id": sessionId ?? "" }));
    expect(response.status).toBe(200);
    expect((await readAnswer(response)).result?.tools?.map((tool) => tool.name)).toEqual(["whoami", "add_note"]);
  });

  it("answers 404 to a session opened before a release changed a tool, so the client initializes again", async () => {
    const token = await issue(false);
    const { sessionId } = await initialize(createMcpEndpoint({ createServer: createFactory("Says whose account this is.") }), token);
    const released = createMcpEndpoint({ createServer: createFactory("Says whose account this is, with the plan.") });
    const stale = await released(test.ctx, request(listTools(), token, { "mcp-session-id": sessionId ?? "" }));
    expect(stale.status).toBe(404);
    expect(stale.headers.get("cache-control")).toBe("no-store");
    expect((await readAnswer(stale)).error?.code).toBe(-32001);

    const renewed = await initialize(released, token);
    expect(renewed.sessionId).not.toBe(sessionId);
    const listed = await released(test.ctx, request(listTools(), token, { "mcp-session-id": renewed.sessionId ?? "" }));
    expect(listed.status).toBe(200);
  });

  it("answers 404 when the access level changed, since the other level lists other tools", async () => {
    const endpoint = createMcpEndpoint({ createServer: createFactory("Says whose account this is.") });
    const { sessionId } = await initialize(endpoint, await issue(false));
    const response = await endpoint(test.ctx, request(listTools(), await issue(true), { "mcp-session-id": sessionId ?? "" }));
    expect(response.status).toBe(404);
  });

  it("answers 404 to a session id the endpoint did not issue", async () => {
    const endpoint = createMcpEndpoint({ createServer: createFactory("Says whose account this is.") });
    for (const sessionId of ["abc", "not base64.zz", ""]) {
      const response = await endpoint(test.ctx, request(listTools(), await issue(false), { "mcp-session-id": sessionId }));
      expect(response.status, sessionId).toBe(404);
    }
  });

  it("serves a client without a session id as before", async () => {
    const endpoint = createMcpEndpoint({ createServer: createFactory("Says whose account this is.") });
    const response = await endpoint(test.ctx, request(callTool("whoami"), await issue(false)));
    expect(response.status).toBe(200);
    expect(response.headers.get("mcp-session-id")).toBeNull();
  });

  it("still asks for a token before it looks at the session", async () => {
    const endpoint = createMcpEndpoint({ createServer: createFactory("Says whose account this is.") });
    const response = await endpoint(test.ctx, createMcpRequest(listTools()));
    expect(response.status).toBe(401);
  });

  it("issues no session id for a hand-written factory, yet declares no list_changed", async () => {
    const endpoint = createMcpEndpoint({ createServer: createDemoServer });
    const { sessionId, answer } = await initialize(endpoint, await issue(false));
    expect(sessionId).toBeNull();
    expect(answer.result?.capabilities?.tools?.listChanged).toBe(false);
  });

  it("takes the version from the endpoint option for a hand-written factory", async () => {
    const toolListVersion = vi.fn(({ canWrite }: { canWrite: boolean }) => Promise.resolve(canWrite ? "2.0.0-write" : "2.0.0-read"));
    const endpoint = createMcpEndpoint({ createServer: createDemoServer, toolListVersion });
    const token = await issue(false);
    const { sessionId } = await initialize(endpoint, token);
    expect(readToolListSessionVersion(sessionId ?? "")).toBe("2.0.0-read");
    toolListVersion.mockImplementation(() => Promise.resolve("2.0.1-read"));
    expect((await endpoint(test.ctx, request(listTools(), token, { "mcp-session-id": sessionId ?? "" }))).status).toBe(404);
  });

  it("serves statelessly when the version cannot be read", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const toolListVersion = () => Promise.reject(new Error("measurement failed"));
    const endpoint = createMcpEndpoint({ createServer: createDemoServer, toolListVersion });
    const { response, sessionId } = await initialize(endpoint, await issue(false));
    expect(response.status).toBe(200);
    expect(sessionId).toBeNull();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("reading the tool list version failed"));
  });
});

describe("the session ids", () => {
  it("carry any version, also one with characters a header could not hold", () => {
    for (const version of ["1.0.0-tools-0123456789ab", "fixed version ü"]) {
      const sessionId = createToolListSessionId(version);
      expect(sessionId).toMatch(/^[\x21-\x7e]+$/);
      expect(readToolListSessionVersion(sessionId)).toBe(version);
    }
  });

  it("differ for every session of the same version", () => {
    expect(createToolListSessionId("1.0.0")).not.toBe(createToolListSessionId("1.0.0"));
  });
});

describe("expectToolListSessionRenewed", () => {
  it("passes when a changed tool list renews the sessions of the levels it changed", async () => {
    await expect(expectToolListSessionRenewed(createFactory("Before."), createFactory("After."))).resolves.toBeUndefined();
  });

  it("throws when the tool list did not change, naming the levels", async () => {
    await expect(expectToolListSessionRenewed(createFactory("Same."), createFactory("Same."))).rejects.toThrow(/read, write/);
  });

  it("throws for a factory that cannot tell its version", async () => {
    await expect(expectToolListSessionRenewed(createDemoServer, createFactory("After."))).rejects.toThrow(/toolListVersion/);
  });
});

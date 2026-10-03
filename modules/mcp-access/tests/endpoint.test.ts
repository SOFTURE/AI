// POST /api/mcp: the client is identified and counted, then the Bearer token verified, then the
// app's factory serves the request with that token's identity. Every refusal says only what failed.
import { MCP_RATE_LIMIT_BUCKETS } from "@softure-ai/mcp-access";
import { createMcpEndpoint, issueAccessToken, revokeAccessToken, type McpServerFactory } from "@softure-ai/mcp-access/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { callTool, createConfig, failOn, createDemoServer, createMcpRequest, createTestMcp, createUser, listTools, OPTIONS, type TestMcp } from "./support.js";

const DAY_MS = 24 * 60 * 60 * 1000;

interface JsonRpcAnswer {
  readonly result?: { readonly tools?: { readonly name: string }[]; readonly content?: { readonly text: string }[]; readonly isError?: boolean };
  readonly error?: { readonly message: string };
}

/** The JSON-RPC answer of a response, sent as JSON or as one SSE `message` event. */
async function readAnswer(response: Response): Promise<JsonRpcAnswer> {
  const body = await response.text();
  const data = body.startsWith("event:") ? body.split("\n").find((line) => line.startsWith("data: "))?.slice(6) : body;
  return JSON.parse(data ?? "null") as JsonRpcAnswer;
}

describe("the MCP endpoint", () => {
  let test: TestMcp;
  let alice: string;
  const createServer = vi.fn<McpServerFactory>(createDemoServer);
  const endpoint = createMcpEndpoint({ createServer });

  beforeEach(async () => {
    test = await createTestMcp();
    alice = await createUser(test.database, "alice@example.com");
    createServer.mockClear();
  });
  afterEach(async () => {
    await test.database.close();
    vi.restoreAllMocks();
  });

  async function issue(userId: string, canWrite: boolean): Promise<string> {
    const result = await issueAccessToken(test.ctx, { userId, name: "Laptop", canWrite });
    if (!result.ok) throw new Error(`issue failed: ${result.error}`);
    return result.value.token;
  }

  const send = (body: unknown, options: Parameters<typeof createMcpRequest>[1] = {}) => endpoint(test.ctx, createMcpRequest(body, options));

  describe("with a valid token", () => {
    it("serves the app's server with the token owner's identity", async () => {
      const token = await issue(alice, false);
      const response = await send(callTool("whoami"), { token });
      expect(response.status).toBe(200);
      expect((await readAnswer(response)).result?.content?.[0]?.text).toBe(JSON.stringify({ userId: alice, canWrite: false }));
      expect(createServer).toHaveBeenCalledWith(expect.objectContaining({ userId: alice, canWrite: false }));
    });

    it("builds a server per request, so two accounts never share one", async () => {
      const bob = await createUser(test.database, "bob@example.com");
      const answers = await Promise.all([
        send(callTool("whoami"), { token: await issue(alice, false) }).then(readAnswer),
        send(callTool("whoami"), { token: await issue(bob, false) }).then(readAnswer),
      ]);
      expect(answers.map((answer) => (JSON.parse(answer.result?.content?.[0]?.text ?? "{}") as { userId: string }).userId)).toEqual([alice, bob]);
      expect(createServer).toHaveBeenCalledTimes(2);
    });

    it("gives a read-only token no write tools", async () => {
      const token = await issue(alice, false);
      expect((await readAnswer(await send(listTools(), { token }))).result?.tools?.map((tool) => tool.name)).toEqual(["whoami"]);
      const call = await readAnswer(await send(callTool("add_note", { text: "hi" }), { token }));
      expect(call.result?.isError ?? call.error !== undefined).toBe(true);
      expect(JSON.stringify(call)).not.toContain("noted");
    });

    it("lets a write token call write tools while the app allows writes", async () => {
      const token = await issue(alice, true);
      expect((await readAnswer(await send(listTools(), { token }))).result?.tools?.map((tool) => tool.name)).toEqual(["whoami", "add_note"]);
      expect((await readAnswer(await send(callTool("add_note", { text: "hi" }), { token }))).result?.content?.[0]?.text).toBe("noted: hi");
    });

    it("withholds write access from a write token once the app stops allowing writes", async () => {
      const token = await issue(alice, true);
      const readOnly = { ...test.ctx, config: createConfig({ ...OPTIONS, allowWrites: false, tools: [] }) };
      await endpoint(readOnly, createMcpRequest(callTool("whoami"), { token }));
      expect(createServer).toHaveBeenCalledWith(expect.objectContaining({ userId: alice, canWrite: false }));
    });

    it("accepts the scheme in any case", async () => {
      const token = await issue(alice, false);
      expect((await send(callTool("whoami"), { authorization: `bearer ${token}` })).status).toBe(200);
    });
  });

  describe("refuses with 401 invalid_token and builds no server", () => {
    async function expectUnauthorized(response: Response): Promise<void> {
      expect(response.status).toBe(401);
      expect(response.headers.get("www-authenticate")).toMatch(/^Bearer error="invalid_token"/);
      expect(await response.json()).toEqual({ error: "invalid_token", error_description: expect.any(String) as string });
      expect(createServer).not.toHaveBeenCalled();
    }

    it("without an Authorization header", async () => {
      await expectUnauthorized(await send(callTool("whoami")));
    });

    it("with another scheme", async () => {
      await expectUnauthorized(await send(callTool("whoami"), { authorization: `Basic ${await issue(alice, false)}` }));
    });

    it("with an unknown token", async () => {
      await expectUnauthorized(await send(callTool("whoami"), { token: `sftmcp_${"A".repeat(43)}` }));
    });

    it("with an expired token", async () => {
      const token = await issue(alice, false);
      test.clock.advance(90 * DAY_MS);
      await expectUnauthorized(await send(callTool("whoami"), { token }));
    });

    it("with a revoked token", async () => {
      const result = await issueAccessToken(test.ctx, { userId: alice, name: "Laptop", canWrite: false });
      if (!result.ok) throw new Error("issue failed");
      await revokeAccessToken(test.ctx, { userId: alice, tokenId: result.value.id });
      await expectUnauthorized(await send(callTool("whoami"), { token: result.value.token }));
    });

    it("with the same answer for an unknown and an expired token", async () => {
      const token = await issue(alice, false);
      test.clock.advance(90 * DAY_MS);
      const expired = await send(callTool("whoami"), { token });
      const unknown = await send(callTool("whoami"), { token: `sftmcp_${"B".repeat(43)}` });
      expect([expired.status, await expired.text(), [...expired.headers]]).toEqual([unknown.status, await unknown.text(), [...unknown.headers]]);
    });
  });

  describe("the rate limit", () => {
    it("counts every request per client address before verification, and answers 429 with Retry-After", async () => {
      const { limit } = MCP_RATE_LIMIT_BUCKETS.mcp;
      const token = await issue(alice, false);
      for (let attempt = 0; attempt < limit; attempt += 1) {
        await send(callTool("whoami"), { token: attempt % 2 === 0 ? token : "wrong" });
      }
      const refused = await send(callTool("whoami"), { token });
      expect(refused.status).toBe(429);
      expect(refused.headers.get("retry-after")).toBe(String(15 * 60));
      expect(await refused.json()).toEqual({ error: "too_many_requests" });
      expect((await send(callTool("whoami"), { token, ip: "198.51.100.1" })).status).toBe(200);
    }, 60_000);

    it("refuses a client it cannot identify with 400", async () => {
      const response = await send(callTool("whoami"), { token: await issue(alice, false), ip: null });
      expect([response.status, await response.json()]).toEqual([400, { error: "client_unidentified" }]);
      expect(createServer).not.toHaveBeenCalled();
    });

    it("fails closed with 503 and no detail when the limiter's database fails", async () => {
      const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const db = failOn(test.ctx.db, "insert", 'relation "security.rate_limits" does not exist');
      const response = await endpoint({ ...test.ctx, db }, createMcpRequest(callTool("whoami"), { token: "anything" }));
      expect([response.status, await response.text()]).toEqual([503, JSON.stringify({ error: "temporarily_unavailable" })]);
      expect(log).toHaveBeenCalledWith("@softure-ai/mcp-access: counting a request failed: Error");
    });
  });

  it("answers 500 without detail when the token lookup fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const db = failOn(test.ctx.db, "select", 'relation "mcp.access_tokens" does not exist');
    const response = await endpoint({ ...test.ctx, db }, createMcpRequest(callTool("whoami"), { token: `sftmcp_${"A".repeat(43)}` }));
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("access_tokens");
    expect(log).toHaveBeenCalledWith("@softure-ai/mcp-access: verifying a token failed: Error");
  });

  it("refuses a body over 1 MiB with 413 before building a server", async () => {
    const token = await issue(alice, false);
    const response = await send(callTool("whoami", { padding: "x".repeat(1024 * 1024) }), { token });
    expect(response.status).toBe(413);
    expect(createServer).not.toHaveBeenCalled();
  });

  it("throws when the app did not give security the mcp bucket", async () => {
    const config = { ...test.config, modules: test.config.modules.map((module) => (module.id === "security" ? { ...module, options: { buckets: {} } } : module)) };
    await expect(endpoint({ ...test.ctx, config }, createMcpRequest(listTools()))).rejects.toThrow(
      '@softure-ai/mcp-access: the security module has no "mcp" bucket; spread MCP_RATE_LIMIT_BUCKETS into security({ buckets })',
    );
  });
});

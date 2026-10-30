// Issue #904: the `mcp-access.writes_enabled` switch takes writes away at runtime, without a deploy.
// Writes need `allowWrites`, the token's write access and the switch; an app that does not define the
// switch keeps `allowWrites` alone. Off, write tools are not served, the challenge and the default
// OAuth scope name only `mcp:read`, the consent request offers no writes and a ticked decision reads only.
import { InMemoryTransport } from "@modelcontextprotocol/server";
import { mcpAccess, WRITES_ENABLED_SWITCH, type McpServerIdentity } from "@softure-ai/mcp-access";
import {
  createMcpEndpoint,
  getCodeChallenge,
  handleAuthorizationDecision,
  handleClientRegistration,
  isWritingEnabled,
  issueAccessToken,
  validateAuthorizationRequest,
  type McpAccessContext,
} from "@softure-ai/mcp-access/server";
import { serveMcpStdio } from "@softure-ai/mcp-access/stdio";
import { defineModule, type SwitchReader, type SwitchReading } from "@softure-ai/core";
import type { CommandDatabase } from "@softure-ai/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CLIENT_IP, createConfig, createDemoServer, createMcpRequest, createTestMcp, createUser, listTools, OAUTH_OPTIONS, OPTIONS, REDIRECT_URI, VERIFIER, type TestMcp } from "./support.js";

const ORIGIN = "http://localhost:3000";

/** A switch provider as feature-switches is one: it answers the switches in `values` and `undeclared` for others. */
function switchProvider(reader: SwitchReader) {
  const manifest = {
    id: "switch-provider",
    version: "0.0.0",
    dependsOn: {},
    dbSchema: null,
    tables: [],
    env: [],
    switches: [],
    routes: {},
    mount: [],
    privacy: { exports: false, deletes: false },
  };
  return defineModule({ manifest, messages: { en: {}, pl: {} }, switchReader: reader })();
}

function answering(values: Readonly<Record<string, boolean>>, calls: string[] = []): SwitchReader {
  return (_context, name) => {
    calls.push(name);
    const isEnabled = values[name];
    return Promise.resolve<SwitchReading>(isEnabled === undefined ? { kind: "undeclared" } : { kind: "value", isEnabled });
  };
}

const writesSwitch = (isEnabled: boolean) => switchProvider(answering({ [WRITES_ENABLED_SWITCH]: isEnabled }));

interface ToolsAnswer {
  readonly result?: { readonly tools?: { readonly name: string }[] };
}

describe("the writes switch (#904)", () => {
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

  const withSwitch = (reader: SwitchReader | null, options = OPTIONS): McpAccessContext => ({
    ...test.ctx,
    config: createConfig(options, "en", reader === null ? [] : [switchProvider(reader)]),
  });

  it("is declared in the module manifest, so feature-switches reports it when the app does not define it", () => {
    expect(WRITES_ENABLED_SWITCH).toBe("mcp-access.writes_enabled");
    expect(mcpAccess(OPTIONS).manifest.switches).toEqual(["mcp-access.writes_enabled"]);
  });

  describe("isWritingEnabled", () => {
    it.each([
      ["on", answering({ [WRITES_ENABLED_SWITCH]: true }), true],
      ["off", answering({ [WRITES_ENABLED_SWITCH]: false }), false],
      ["not defined by the app", answering({}), true],
      ["without a switch provider", null, true],
    ])("follows allowWrites and the switch when it is %s", async (_case, reader, expected) => {
      expect(await isWritingEnabled(withSwitch(reader))).toBe(expected);
    });

    it("does not read the switch while allowWrites is off", async () => {
      const calls: string[] = [];
      expect(await isWritingEnabled(withSwitch(answering({ [WRITES_ENABLED_SWITCH]: true }, calls), { ...OPTIONS, allowWrites: false, tools: [] }))).toBe(false);
      expect(calls).toEqual([]);
    });

    it("reads a switch that throws as off and logs its name only", async () => {
      const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const throwing: SwitchReader = () => Promise.reject(new Error("connection refused for postgres://secret@db"));
      expect(await isWritingEnabled(withSwitch(throwing))).toBe(false);
      const logged = log.mock.calls.map((call) => String(call[0])).join("\n");
      expect(logged).toContain("mcp-access.writes_enabled");
      expect(logged).not.toContain("secret");
    });
  });

  describe("the endpoint", () => {
    let identities: McpServerIdentity[] = [];
    const endpoint = createMcpEndpoint({
      createServer: (identity) => {
        identities.push(identity);
        return createDemoServer(identity);
      },
    });

    beforeEach(() => {
      identities = [];
    });

    async function writeToken(): Promise<string> {
      const result = await issueAccessToken(test.ctx, { userId: alice, name: "Laptop", canWrite: true });
      if (!result.ok) throw new Error(`issue failed: ${result.error}`);
      return result.value.token;
    }

    async function listToolNames(ctx: McpAccessContext, token: string): Promise<string[] | undefined> {
      // The answer is JSON or one SSE `message` event, as the SDK chooses.
      const body = await (await endpoint(ctx, createMcpRequest(listTools(), { token }))).text();
      const data = body.startsWith("event:") ? body.split("\n").find((line) => line.startsWith("data: "))?.slice(6) : body;
      return (JSON.parse(data ?? "null") as ToolsAnswer).result?.tools?.map((tool) => tool.name);
    }

    it("serves a write token no write tools while the switch is off, and writes again once it is on", async () => {
      const token = await writeToken();
      const off = { ...test.ctx, config: createConfig(OPTIONS, "en", [writesSwitch(false)]) };
      expect(await listToolNames(off, token)).toEqual(["whoami"]);
      expect(identities.at(-1)).toEqual(expect.objectContaining({ userId: alice, canWrite: false }));
      const on = { ...test.ctx, config: createConfig(OPTIONS, "en", [writesSwitch(true)]) };
      expect(await listToolNames(on, token)).toEqual(["whoami", "add_note"]);
      expect(identities.at(-1)).toEqual(expect.objectContaining({ userId: alice, canWrite: true }));
    });

    it("keeps write tools for a write token when the app does not define the switch", async () => {
      expect(await listToolNames(withSwitch(answering({})), await writeToken())).toEqual(["whoami", "add_note"]);
    });

    it.each([
      ["off", false, 'scope="mcp:read"'],
      ["on", true, 'scope="mcp:read mcp:write"'],
    ])("names the scopes the switch allows in the challenge while it is %s", async (_case, isEnabled, scope) => {
      const ctx = { ...test.ctx, config: createConfig(OAUTH_OPTIONS, "en", [writesSwitch(isEnabled)]) };
      const response = await endpoint(ctx, createMcpRequest(listTools()));
      expect(response.status).toBe(401);
      expect(response.headers.get("www-authenticate")).toContain(scope);
    });
  });

  describe("OAuth", () => {
    async function registerClient(ctx: McpAccessContext): Promise<string> {
      const request = new Request(`${ORIGIN}/api/oauth/register`, {
        method: "POST",
        headers: { "x-real-ip": CLIENT_IP, "content-type": "application/json" },
        body: JSON.stringify({ client_name: "Assistant", redirect_uris: [REDIRECT_URI], token_endpoint_auth_method: "none" }),
      });
      const body = (await (await handleClientRegistration(ctx, request)).json()) as { client_id?: string };
      return body.client_id ?? "";
    }

    function authorizationParams(clientId: string, scope: string | null): URLSearchParams {
      const params = new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        redirect_uri: REDIRECT_URI,
        state: "state-1",
        code_challenge: getCodeChallenge(VERIFIER),
        code_challenge_method: "S256",
      });
      if (scope !== null) params.set("scope", scope);
      return params;
    }

    it.each([
      ["off, for a client asking to write", false, "mcp:read mcp:write", { isWriteRequested: true, isWriteOffered: false }],
      ["off, for a client sending no scope", false, null, { isWriteRequested: false, isWriteOffered: false }],
      ["on, for a client sending no scope", true, null, { isWriteRequested: true, isWriteOffered: true }],
      ["on, for a client asking to read", true, "mcp:read", { isWriteRequested: false, isWriteOffered: false }],
    ])("offers writes on the consent page only when the switch allows them: %s", async (_case, isEnabled, scope, expected) => {
      const ctx = { ...test.ctx, config: createConfig(OAUTH_OPTIONS, "en", [writesSwitch(isEnabled)]) };
      const outcome = await validateAuthorizationRequest(ctx, authorizationParams(await registerClient(ctx), scope));
      expect(outcome.kind === "valid" && { isWriteRequested: outcome.request.isWriteRequested, isWriteOffered: outcome.request.isWriteOffered }).toEqual(expected);
    });

    it("grants read only to a decision that ticks writes while the switch is off", async () => {
      const ctx = { ...test.ctx, config: createConfig(OAUTH_OPTIONS, "en", [writesSwitch(false)]) };
      const body = authorizationParams(await registerClient(ctx), "mcp:read mcp:write");
      body.set("decision", "allow");
      body.set("canWrite", "on");
      const request = new Request(`${ORIGIN}/api/oauth/authorize`, {
        method: "POST",
        headers: { "x-real-ip": CLIENT_IP, "content-type": "application/x-www-form-urlencoded", origin: ORIGIN },
        body: body.toString(),
      });
      const response = await handleAuthorizationDecision(ctx, request, alice);
      expect(response.status).toBe(303);
      expect(new URL(response.headers.get("location") ?? "").searchParams.get("code")).not.toBeNull();
      const grants = await test.database.client.query<{ can_write: boolean }>("SELECT can_write FROM mcp.oauth_authorization_codes");
      expect(grants.rows).toEqual([{ can_write: false }]);
    });
  });

  describe("the stdio entry", () => {
    const openDatabase = (): Promise<CommandDatabase> =>
      Promise.resolve({
        handle: { kind: "pglite", db: test.database.db, client: test.database.client, close: () => Promise.resolve() },
        close: () => Promise.resolve(),
      });

    it.each([
      ["off", false, false],
      ["on", true, true],
    ])("writes only while the switch is %s at start", async (_case, isEnabled, canWrite) => {
      const [, server] = InMemoryTransport.createLinkedPair();
      const started = await serveMcpStdio({
        config: createConfig(OPTIONS, "en", [writesSwitch(isEnabled)]),
        createServer: createDemoServer,
        env: {},
        allowWrites: true,
        transport: server,
        openDatabase,
      });
      expect(started.ok && started.value.identity.canWrite).toBe(canWrite);
      if (started.ok) await started.value.close();
    });
  });
});

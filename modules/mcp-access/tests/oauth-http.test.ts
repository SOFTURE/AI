// The OAuth HTTP layer: discovery documents, registration, the token endpoint, the authorization
// request's validation order and the consent decision, as an MCP client and a browser see them.
import { MCP_RATE_LIMIT_BUCKETS, mcpAccess } from "@softure-ai/mcp-access";
import {
  answerOAuthPreflight,
  createAuthorizationCode,
  getAuthorizationServerMetadata,
  getCodeChallenge,
  getProtectedResourceMetadata,
  getProtectedResourceMetadataUrl,
  handleAuthorizationDecision,
  handleClientRegistration,
  handleTokenRequest,
  readAuthorizationParams,
  serveDiscoveryDocument,
  validateAuthorizationRequest,
  verifyAccessToken,
} from "@softure-ai/mcp-access/server";
import { headerIp, security } from "@softure-ai/security";
import { AUTH_RATE_LIMIT_BUCKETS, auth } from "@softure-ai/auth";
import { defineSoftureConfig } from "@softure-ai/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CLIENT_IP, connectApp, createConfig, createTestMcp, createUser, OAUTH_OPTIONS, OPTIONS, REDIRECT_URI, VERIFIER, type TestMcp } from "./support.js";

const ORIGIN = "http://localhost:3000";
const CHALLENGE = getCodeChallenge(VERIFIER);

interface OAuthBody {
  readonly error?: string;
  readonly error_description?: string;
  readonly client_id?: string;
  readonly client_secret?: string;
  readonly access_token?: string;
  readonly refresh_token?: string;
  readonly scope?: string;
  readonly expires_in?: number;
  readonly token_type?: string;
}

function post(path: string, body: string, headers: Record<string, string> = {}): Request {
  return new Request(`${ORIGIN}${path}`, { method: "POST", headers: { "x-real-ip": CLIENT_IP, ...headers }, body });
}

const json = (body: unknown) => JSON.stringify(body);
const form = (fields: Record<string, string>) => new URLSearchParams(fields).toString();
const FORM = { "content-type": "application/x-www-form-urlencoded" };

describe("the OAuth HTTP layer", () => {
  let test: TestMcp;
  let alice: string;

  beforeEach(async () => {
    test = await createTestMcp(createConfig(OAUTH_OPTIONS));
    alice = await createUser(test.database, "alice@example.com");
  });
  afterEach(async () => {
    await test.database.close();
    vi.restoreAllMocks();
  });

  async function register(body: unknown = { client_name: "Assistant", redirect_uris: [REDIRECT_URI], token_endpoint_auth_method: "none" }) {
    const response = await handleClientRegistration(test.ctx, post("/api/oauth/register", json(body), { "content-type": "application/json" }));
    return { response, body: (await response.json()) as OAuthBody };
  }

  async function requestToken(fields: Record<string, string>, headers: Record<string, string> = {}) {
    const response = await handleTokenRequest(test.ctx, post("/api/oauth/token", form(fields), { ...FORM, ...headers }));
    return { response, body: (await response.json()) as OAuthBody };
  }

  function authorizationParams(clientId: string, change: Record<string, string | null> = {}): URLSearchParams {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      state: "state-1",
      code_challenge: CHALLENGE,
      code_challenge_method: "S256",
      scope: "mcp:read mcp:write",
    });
    for (const [key, value] of Object.entries(change)) {
      if (value === null) params.delete(key);
      else params.set(key, value);
    }
    return params;
  }

  function decide(params: URLSearchParams, extra: Record<string, string>, userId: string | null = alice, origin: string | null = ORIGIN): Promise<Response> {
    const body = new URLSearchParams(params);
    for (const [key, value] of Object.entries(extra)) body.set(key, value);
    const headers: Record<string, string> = { ...FORM };
    if (origin !== null) headers.origin = origin;
    return handleAuthorizationDecision(test.ctx, post("/api/oauth/authorize", body.toString(), headers), userId);
  }

  describe("discovery", () => {
    it("describes the authorization server at the app's origin, with S256 and the module's routes", () => {
      expect(getAuthorizationServerMetadata(test.config)).toEqual({
        issuer: ORIGIN,
        authorization_endpoint: `${ORIGIN}/oauth/authorize`,
        token_endpoint: `${ORIGIN}/api/oauth/token`,
        registration_endpoint: `${ORIGIN}/api/oauth/register`,
        scopes_supported: ["mcp:read", "mcp:write"],
        response_types_supported: ["code"],
        response_modes_supported: ["query"],
        grant_types_supported: ["authorization_code", "refresh_token"],
        token_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
        code_challenge_methods_supported: ["S256"],
        authorization_response_iss_parameter_supported: true,
      });
    });

    it("names the endpoint as the resource at its own path and the origin at the root", () => {
      expect(getProtectedResourceMetadataUrl(test.config)).toBe(`${ORIGIN}/.well-known/oauth-protected-resource/api/mcp`);
      expect(getProtectedResourceMetadata(test.config, "endpoint")).toEqual({
        resource: `${ORIGIN}/api/mcp`,
        authorization_servers: [ORIGIN],
        scopes_supported: ["mcp:read", "mcp:write"],
        bearer_methods_supported: ["header"],
        resource_name: "acme",
      });
      expect(getProtectedResourceMetadata(test.config, "root").resource).toBe(ORIGIN);
    });

    it("serves the documents with CORS, and 404 while OAuth is off", () => {
      const served = serveDiscoveryDocument(test.config, getAuthorizationServerMetadata);
      expect(served.status).toBe(200);
      expect(served.headers.get("access-control-allow-origin")).toBe("*");
      expect(serveDiscoveryDocument(createConfig(OPTIONS), getAuthorizationServerMetadata).status).toBe(404);
      expect(answerOAuthPreflight().status).toBe(204);
    });
  });

  describe("registration", () => {
    it("registers a public client and answers 201 without a secret", async () => {
      const { response, body } = await register();
      expect(response.status).toBe(201);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(body).toMatchObject({ client_name: "Assistant", redirect_uris: [REDIRECT_URI], token_endpoint_auth_method: "none" });
      expect(body.client_secret).toBeUndefined();
    });

    it("defaults to client_secret_basic and returns the secret once", async () => {
      const { body } = await register({ redirect_uris: [REDIRECT_URI] });
      expect(body.client_secret).toMatch(/^sftmcs_/);
    });

    it("names a nameless client after its redirect host and cuts a long name to 60", async () => {
      expect((await register({ redirect_uris: [REDIRECT_URI] })).body).toMatchObject({ client_name: "assistant.example" });
      expect((await register({ client_name: ` ${"x".repeat(70)}\u0007 `, redirect_uris: [REDIRECT_URI] })).body).toMatchObject({ client_name: "x".repeat(60) });
    });

    it.each([
      ["no redirect URI", { redirect_uris: [] }, "invalid_redirect_uri"],
      ["a javascript: redirect", { redirect_uris: ["javascript:alert(1)"] }, "invalid_redirect_uri"],
      ["plain http off loopback", { redirect_uris: ["http://assistant.example/cb"] }, "invalid_redirect_uri"],
      ["a fragment", { redirect_uris: ["https://assistant.example/cb#x"] }, "invalid_redirect_uri"],
      ["an unknown auth method", { redirect_uris: [REDIRECT_URI], token_endpoint_auth_method: "private_key_jwt" }, "invalid_client_metadata"],
    ])("refuses %s", async (_case, body, error) => {
      const { response, body: answer } = await register(body);
      expect(response.status).toBe(400);
      expect(answer.error).toBe(error);
    });

    it("accepts loopback http and a native app scheme", async () => {
      expect((await register({ redirect_uris: ["http://127.0.0.1:33418/cb", "cursor://anysphere.cursor-retrieval/oauth/callback"] })).response.status).toBe(201);
    });

    it("refuses a body that is not JSON", async () => {
      const response = await handleClientRegistration(test.ctx, post("/api/oauth/register", "{", { "content-type": "application/json" }));
      expect(response.status).toBe(400);
      expect(((await response.json()) as OAuthBody).error).toBe("invalid_client_metadata");
    });

    it("counts registrations per address and answers 429 over the limit", async () => {
      for (let attempt = 0; attempt < MCP_RATE_LIMIT_BUCKETS["mcp-oauth"].limit; attempt++) expect((await register()).response.status).toBe(201);
      const { response } = await register();
      expect(response.status).toBe(429);
      expect(response.headers.get("retry-after")).not.toBeNull();
    });

    it("answers 404 while OAuth is off", async () => {
      const response = await handleClientRegistration({ ...test.ctx, config: createConfig(OPTIONS) }, post("/api/oauth/register", json({ redirect_uris: [REDIRECT_URI] })));
      expect(response.status).toBe(404);
    });

    it("throws by name when the security module lacks the mcp-oauth bucket", async () => {
      const config = defineSoftureConfig({
        database: { url: "pglite://" },
        locale: "en",
        timezone: "UTC",
        appOrigin: ORIGIN,
        modules: [security({ clientIp: headerIp("x-real-ip"), buckets: { ...AUTH_RATE_LIMIT_BUCKETS, mcp: MCP_RATE_LIMIT_BUCKETS.mcp } }), auth({}), mcpAccess(OAUTH_OPTIONS)],
      });
      await expect(handleClientRegistration({ ...test.ctx, config }, post("/api/oauth/register", json({ redirect_uris: [REDIRECT_URI] })))).rejects.toThrow(/"mcp-oauth" bucket/);
    });
  });

  describe("the token endpoint", () => {
    it("exchanges a code for tokens with PKCE, and refreshes them", async () => {
      const { client } = await connectApp(test.ctx, alice);
      const code = await createAuthorizationCode(test.ctx, { clientRowId: client.id, userId: alice, redirectUri: REDIRECT_URI, codeChallenge: CHALLENGE, canWrite: true });
      const exchanged = await requestToken({ grant_type: "authorization_code", code, redirect_uri: REDIRECT_URI, code_verifier: VERIFIER, client_id: client.clientId, resource: `${ORIGIN}/api/mcp` });
      expect(exchanged.response.status).toBe(200);
      expect(exchanged.response.headers.get("cache-control")).toBe("no-store");
      expect(exchanged.body).toMatchObject({ token_type: "Bearer", expires_in: 3600, scope: "mcp:read mcp:write" });
      expect(await verifyAccessToken(test.ctx, exchanged.body.access_token ?? "")).toMatchObject({ userId: alice, canWrite: true });

      const refreshed = await requestToken({ grant_type: "refresh_token", refresh_token: exchanged.body.refresh_token ?? "", client_id: client.clientId });
      expect(refreshed.response.status).toBe(200);
      expect(refreshed.body.refresh_token).not.toBe(exchanged.body.refresh_token);
    });

    it("authenticates a confidential client by Basic or by the body, and refuses a wrong secret", async () => {
      const { body: registered } = await register({ client_name: "Server", redirect_uris: [REDIRECT_URI], token_endpoint_auth_method: "client_secret_basic" });
      const clientId = registered.client_id ?? "";
      const secret = registered.client_secret ?? "";
      const basic = `Basic ${Buffer.from(`${encodeURIComponent(clientId)}:${encodeURIComponent(secret)}`).toString("base64")}`;
      const unsupported = await requestToken({ grant_type: "password" }, { authorization: basic });
      expect([unsupported.response.status, unsupported.body.error]).toEqual([400, "unsupported_grant_type"]);
      const viaBody = await requestToken({ grant_type: "password", client_id: clientId, client_secret: secret });
      expect(viaBody.body.error).toBe("unsupported_grant_type");

      const wrong = await requestToken({ grant_type: "refresh_token", refresh_token: "x" }, { authorization: `Basic ${Buffer.from(`${clientId}:wrong`).toString("base64")}` });
      expect([wrong.response.status, wrong.body.error, wrong.response.headers.get("www-authenticate")]).toEqual([401, "invalid_client", 'Basic realm="mcp"']);
      const missing = await requestToken({ grant_type: "refresh_token", refresh_token: "x", client_id: clientId });
      expect([missing.response.status, missing.body.error]).toEqual([401, "invalid_client"]);
    });

    it.each([
      ["an unknown client", { client_id: "nobody" }, 401, "invalid_client"],
      ["a missing verifier", { grant_type: "authorization_code", code: "sftmca_x" }, 400, "invalid_request"],
      ["an unknown code", { grant_type: "authorization_code", code: "sftmca_x", code_verifier: VERIFIER }, 400, "invalid_grant"],
      ["an unknown refresh token", { grant_type: "refresh_token", refresh_token: "sftmcr_x" }, 400, "invalid_grant"],
      ["another resource", { grant_type: "refresh_token", refresh_token: "sftmcr_x", resource: "https://elsewhere.example/mcp" }, 400, "invalid_target"],
    ])("refuses %s", async (_case, fields, status, error) => {
      const { client } = await connectApp(test.ctx, alice);
      const answer = await requestToken({ client_id: client.clientId, ...fields });
      expect([answer.response.status, answer.body.error]).toEqual([status, error]);
    });

    it("counts per address and client id, so one client's flood leaves another's room", async () => {
      const { client } = await connectApp(test.ctx, alice);
      const { client: other } = await connectApp(test.ctx, alice, { clientName: "Other" });
      for (let attempt = 0; attempt < MCP_RATE_LIMIT_BUCKETS["mcp-oauth"].limit; attempt++) await requestToken({ client_id: client.clientId, grant_type: "refresh_token", refresh_token: "x" });
      expect((await requestToken({ client_id: client.clientId, grant_type: "refresh_token", refresh_token: "x" })).response.status).toBe(429);
      expect((await requestToken({ client_id: other.clientId, grant_type: "refresh_token", refresh_token: "x" })).response.status).toBe(400);
    });

    it("answers 500 without details when the database fails, and logs no secret", async () => {
      const { client, tokens } = await connectApp(test.ctx, alice);
      const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const ctx = { ...test.ctx, db: new Proxy(test.ctx.db, { get: (target, key): unknown => (key === "transaction" ? () => Promise.reject(new Error("connect ECONNREFUSED")) : (Reflect.get(target, key) as unknown)) }) };
      const response = await handleTokenRequest(ctx, post("/api/oauth/token", form({ grant_type: "refresh_token", refresh_token: tokens.refreshToken, client_id: client.clientId }), FORM));
      expect(response.status).toBe(500);
      expect(log.mock.calls.map((call) => String(call[0])).join("\n")).not.toContain(tokens.refreshToken);
    });
  });

  describe("the authorization request", () => {
    it("is valid with a known client, its redirect URI and S256", async () => {
      const { body } = await register();
      const outcome = await validateAuthorizationRequest(test.ctx, authorizationParams(body.client_id ?? ""));
      expect(outcome.kind === "valid" && { redirectUri: outcome.request.redirectUri, state: outcome.request.state, isWriteRequested: outcome.request.isWriteRequested }).toEqual({
        redirectUri: REDIRECT_URI,
        state: "state-1",
        isWriteRequested: true,
      });
    });

    it("shows, never redirects, an unknown client or a redirect URI the client did not register", async () => {
      const { body } = await register();
      expect(await validateAuthorizationRequest(test.ctx, authorizationParams("nobody"))).toEqual({ kind: "show-error", reason: "unknown_client" });
      expect(await validateAuthorizationRequest(test.ctx, authorizationParams(body.client_id ?? "", { redirect_uri: "https://evil.example/cb" }))).toEqual({
        kind: "show-error",
        reason: "redirect_mismatch",
      });
    });

    it.each([
      ["a response type other than code", { response_type: "token" }, "unsupported_response_type"],
      ["no PKCE", { code_challenge: null }, "invalid_request"],
      ["the plain PKCE method", { code_challenge_method: "plain" }, "invalid_request"],
      ["another resource", { resource: "https://elsewhere.example/mcp" }, "invalid_target"],
    ])("sends %s back to the client with state and iss", async (_case, change, error) => {
      const { body } = await register();
      const outcome = await validateAuthorizationRequest(test.ctx, authorizationParams(body.client_id ?? "", change));
      expect(outcome.kind).toBe("redirect-error");
      const location = new URL(outcome.kind === "redirect-error" ? outcome.location : "");
      expect([location.origin + location.pathname, location.searchParams.get("error"), location.searchParams.get("state"), location.searchParams.get("iss")]).toEqual([
        REDIRECT_URI,
        error,
        "state-1",
        ORIGIN,
      ]);
    });

    it("keeps only the authorization parameters, each at most 2048 characters", () => {
      const query = new URLSearchParams({ client_id: "c", state: "s".repeat(2049), extra: "x" });
      expect([...readAuthorizationParams(query).entries()]).toEqual([["client_id", "c"]]);
    });
  });

  describe("the consent decision", () => {
    async function registeredClientId(): Promise<string> {
      return (await register()).body.client_id ?? "";
    }

    it("sends the code back with state and iss, and the code works once", async () => {
      const clientId = await registeredClientId();
      const response = await decide(authorizationParams(clientId), { decision: "allow" });
      expect(response.status).toBe(303);
      const location = new URL(response.headers.get("location") ?? "");
      expect([location.searchParams.get("state"), location.searchParams.get("iss")]).toEqual(["state-1", ORIGIN]);
      const code = location.searchParams.get("code") ?? "";
      const exchanged = await requestToken({ grant_type: "authorization_code", code, redirect_uri: REDIRECT_URI, code_verifier: VERIFIER, client_id: clientId });
      expect(exchanged.body.scope).toBe("mcp:read");
    });

    it("grants writes only when the client asked, the app allows them and the person ticked the box", async () => {
      const clientId = await registeredClientId();
      const scopeOf = async (response: Response) => {
        const code = new URL(response.headers.get("location") ?? "").searchParams.get("code") ?? "";
        return (await requestToken({ grant_type: "authorization_code", code, redirect_uri: REDIRECT_URI, code_verifier: VERIFIER, client_id: clientId })).body.scope;
      };
      expect(await scopeOf(await decide(authorizationParams(clientId), { decision: "allow", canWrite: "on" }))).toBe("mcp:read mcp:write");
      expect(await scopeOf(await decide(authorizationParams(clientId, { scope: "mcp:read" }), { decision: "allow", canWrite: "on" }))).toBe("mcp:read");
      test = { ...test, ctx: { ...test.ctx, config: createConfig({ ...OAUTH_OPTIONS, allowWrites: false, tools: [] }) } };
      expect(await scopeOf(await decide(authorizationParams(clientId), { decision: "allow", canWrite: "on" }))).toBe("mcp:read");
    });

    it("sends access_denied back when the person denies", async () => {
      const response = await decide(authorizationParams(await registeredClientId()), { decision: "deny" });
      const location = new URL(response.headers.get("location") ?? "");
      expect([location.searchParams.get("error"), location.searchParams.get("code")]).toEqual(["access_denied", null]);
    });

    it("refuses a form from another origin or without one", async () => {
      const params = authorizationParams(await registeredClientId());
      expect((await decide(params, { decision: "allow" }, alice, "https://evil.example")).status).toBe(403);
      expect((await decide(params, { decision: "allow" }, alice, null)).status).toBe(403);
    });

    it("sends a person without a session back to the consent page with every parameter", async () => {
      const params = authorizationParams(await registeredClientId());
      const response = await decide(params, { decision: "allow" }, null);
      expect(response.headers.get("location")).toBe(`/oauth/authorize?${params.toString()}`);
    });

    it("re-validates the posted request: an unknown client goes back to the consent page, never to a redirect", async () => {
      const response = await decide(authorizationParams("nobody", { redirect_uri: "https://evil.example/cb" }), { decision: "allow" });
      expect(response.headers.get("location")).toMatch(/^\/oauth\/authorize\?/);
    });
  });

  describe("the request body cap", () => {
    const DEFAULT_CAP = 16_384;
    const INVALID_UTF8 = new Uint8Array([0x63, 0x3d, 0xff]);

    /** A body streamed in chunks with no Content-Length, as a proxy may forward it. */
    function streamed(path: string, size: number, headers: Record<string, string>): Request {
      const chunk = new TextEncoder().encode("a".repeat(1024));
      let sent = 0;
      const body = new ReadableStream<Uint8Array>({
        pull(controller) {
          if (sent >= size) return controller.close();
          controller.enqueue(chunk);
          sent += chunk.byteLength;
        },
      });
      return new Request(`${ORIGIN}${path}`, { method: "POST", headers: { "x-real-ip": CLIENT_IP, ...headers }, body, duplex: "half" } as RequestInit);
    }

    function rawPost(path: string, body: Uint8Array<ArrayBuffer>, headers: Record<string, string>): Request {
      return new Request(`${ORIGIN}${path}`, { method: "POST", headers: { "x-real-ip": CLIENT_IP, ...headers }, body });
    }

    it("refuses a registration body over the cap with 413 invalid_request, announced or streamed", async () => {
      const large = json({ redirect_uris: [REDIRECT_URI], software_statement: "x".repeat(DEFAULT_CAP) });
      const announced = await handleClientRegistration(test.ctx, post("/api/oauth/register", large, { "content-type": "application/json" }));
      expect([announced.status, ((await announced.json()) as OAuthBody).error]).toEqual([413, "invalid_request"]);
      const stream = await handleClientRegistration(test.ctx, streamed("/api/oauth/register", DEFAULT_CAP + 1024, { "content-type": "application/json" }));
      expect([stream.status, ((await stream.json()) as OAuthBody).error]).toEqual([413, "invalid_request"]);
    });

    it("answers an unreadable registration body as one that is not JSON", async () => {
      const response = await handleClientRegistration(test.ctx, rawPost("/api/oauth/register", INVALID_UTF8, { "content-type": "application/json" }));
      expect([response.status, ((await response.json()) as OAuthBody).error]).toEqual([400, "invalid_client_metadata"]);
    });

    it("takes the cap from oauth.maxBodyBytes", async () => {
      const body = { client_name: "Assistant", redirect_uris: [REDIRECT_URI], token_endpoint_auth_method: "none", software_statement: "x".repeat(3000) };
      expect((await register(body)).response.status).toBe(201);
      test = { ...test, ctx: { ...test.ctx, config: createConfig({ ...OPTIONS, oauth: { enabled: true, maxBodyBytes: 2048 } }) } };
      expect((await register(body)).response.status).toBe(413);
    });

    it("refuses a token body over the cap with 413 invalid_request, and counts it against the address", async () => {
      const large = form({ grant_type: "refresh_token", refresh_token: "x".repeat(DEFAULT_CAP) });
      const send = () => handleTokenRequest(test.ctx, post("/api/oauth/token", large, FORM));
      const first = await send();
      expect([first.status, ((await first.json()) as OAuthBody).error]).toEqual([413, "invalid_request"]);
      for (let attempt = 1; attempt < MCP_RATE_LIMIT_BUCKETS["mcp-oauth"].limit; attempt++) expect((await send()).status).toBe(413);
      expect((await send()).status).toBe(429);
      expect((await handleTokenRequest(test.ctx, streamed("/api/oauth/token", DEFAULT_CAP + 1024, FORM))).status).toBe(429);
    });

    it("answers an unreadable token body as an empty form", async () => {
      const response = await handleTokenRequest(test.ctx, rawPost("/api/oauth/token", INVALID_UTF8, FORM));
      expect([response.status, ((await response.json()) as OAuthBody).error]).toEqual([401, "invalid_client"]);
    });

    it("refuses a consent form over the cap with 413 and an unreadable one with 400", async () => {
      const clientId = (await register()).body.client_id ?? "";
      const tooLarge = await decide(authorizationParams(clientId), { decision: "allow", padding: "x".repeat(DEFAULT_CAP) });
      expect([tooLarge.status, tooLarge.headers.get("location"), tooLarge.headers.get("cache-control")]).toEqual([413, null, "no-store"]);
      const unreadable = await handleAuthorizationDecision(test.ctx, rawPost("/api/oauth/authorize", INVALID_UTF8, { ...FORM, origin: ORIGIN }), alice);
      expect(unreadable.status).toBe(400);
    });

    it("still decides on a multipart consent form", async () => {
      const clientId = (await register()).body.client_id ?? "";
      const body = new FormData();
      for (const [key, value] of authorizationParams(clientId)) body.set(key, value);
      body.set("decision", "allow");
      const request = new Request(`${ORIGIN}/api/oauth/authorize`, { method: "POST", headers: { "x-real-ip": CLIENT_IP, origin: ORIGIN }, body });
      const response = await handleAuthorizationDecision(test.ctx, request, alice);
      expect(response.status).toBe(303);
      expect(new URL(response.headers.get("location") ?? "").searchParams.get("code")).toMatch(/^sftmca_/);
    });
  });
});

// Issue #234: the OAuth layer's URLs come from the request's origins (a resolved app origin and
// extra resource hosts), the discovery documents take the app's extra keys, and apps composing
// from `/server` get the context helper and `OAuthClientRow`.
import { mcpAccess, readRequestOrigin, type McpAccessOptionsInput, type OAuthClientRow } from "@softure-ai/mcp-access";
import {
  createMcpAccessContext,
  createMcpEndpoint,
  findOAuthClient,
  getAuthorizationServerMetadata,
  getCodeChallenge,
  getProtectedResourceMetadata,
  getRootProtectedResourceMetadata,
  handleAuthorizationDecision,
  handleClientRegistration,
  handleTokenRequest,
  isAcceptableResource,
  issueAccessToken,
  registerMcpClient,
  resolveMcpOrigins,
  serveDiscoveryDocument,
  validateAuthorizationRequest,
  type McpOrigins,
} from "@softure-ai/mcp-access/server";
import { afterEach, describe, expect, it } from "vitest";
import { CLIENT_IP, createConfig, createDemoServer, createTestMcp, createUser, listTools, OAUTH_OPTIONS, REDIRECT_URI, VERIFIER, type TestMcp } from "./support.js";

const CONFIGURED = "http://localhost:3000";
const SERVED = "http://localhost:6510";
const APEX = "https://example.test";
const APP = "https://app.example.test";
const FORM = { "content-type": "application/x-www-form-urlencoded" };

function at(origin: string, path: string, init: { method?: string; headers?: Record<string, string>; body?: string } = {}): Request {
  // Behind a proxy the URL names the server's own address; Host names the public one.
  const host = new URL(origin).host;
  return new Request(`http://0.0.0.0:3000${path}`, {
    method: init.method ?? "GET",
    headers: { host, "x-forwarded-proto": new URL(origin).protocol.replace(":", ""), "x-real-ip": CLIENT_IP, ...init.headers },
    ...(init.body === undefined ? {} : { body: init.body }),
  });
}

const fromHost: McpAccessOptionsInput = { ...OAUTH_OPTIONS, resolveAppOrigin: readRequestOrigin };

describe("OAuth origins (#234)", () => {
  let test: TestMcp | null = null;
  afterEach(async () => {
    await test?.database.close();
    test = null;
  });

  async function start(options: McpAccessOptionsInput): Promise<TestMcp> {
    test = await createTestMcp(createConfig(options));
    return test;
  }

  describe("readRequestOrigin", () => {
    it("reads Host and an http(s) X-Forwarded-Proto, else the URL", () => {
      const read = (headers: Record<string, string>) => readRequestOrigin(new Request("http://0.0.0.0:3000/x", { headers }));
      expect(read({ host: "app.example.test", "x-forwarded-proto": "https, http" })).toBe(APP);
      expect(read({ host: "localhost:6510" })).toBe(SERVED);
      expect(read({ host: "app.example.test", "x-forwarded-proto": "wss" })).toBe("http://app.example.test");
      expect(readRequestOrigin({ url: "https://app.example.test/x", headers: new Headers() })).toBe(APP);
    });
  });

  describe("resolveMcpOrigins", () => {
    it("is the configured appOrigin without a resolver, without a request, or when the resolver answers null", () => {
      const config = createConfig(OAUTH_OPTIONS);
      expect(resolveMcpOrigins(config, at(SERVED, "/"))).toEqual({ appOrigin: CONFIGURED, resourceOrigins: [] });
      expect(resolveMcpOrigins(createConfig(fromHost))).toEqual({ appOrigin: CONFIGURED, resourceOrigins: [] });
      expect(resolveMcpOrigins(createConfig({ ...OAUTH_OPTIONS, resolveAppOrigin: () => null }), at(SERVED, "/")).appOrigin).toBe(CONFIGURED);
    });

    it("takes the resolver's origin, reduced to its origin", () => {
      expect(resolveMcpOrigins(createConfig(fromHost), at(SERVED, "/")).appOrigin).toBe(SERVED);
      expect(resolveMcpOrigins(createConfig({ ...OAUTH_OPTIONS, resolveAppOrigin: () => `${APP}/` }), at(SERVED, "/")).appOrigin).toBe(APP);
    });

    it("throws by name when the resolver answers something that is not an http(s) origin", () => {
      for (const value of [`${APP}/api`, "ftp://example.test", "not a url", `${APP}?x=1`]) {
        const config = createConfig({ ...OAUTH_OPTIONS, resolveAppOrigin: () => value });
        expect(() => resolveMcpOrigins(config, at(SERVED, "/"))).toThrow(/resolveAppOrigin returned/);
      }
    });
  });

  describe("an image served under another origin (resolveAppOrigin)", () => {
    it("builds every discovery URL and the 401's resource_metadata from the request's host", async () => {
      const { config, ctx } = await start(fromHost);
      const served = (await serveDiscoveryDocument(config, (c, origins) => getAuthorizationServerMetadata(c, origins), at(SERVED, "/.well-known/oauth-authorization-server")).json()) as Record<string, unknown>;
      expect(served).toMatchObject({ issuer: SERVED, authorization_endpoint: `${SERVED}/oauth/authorize`, token_endpoint: `${SERVED}/api/oauth/token`, registration_endpoint: `${SERVED}/api/oauth/register` });
      const root = (await serveDiscoveryDocument(config, getRootProtectedResourceMetadata, at(SERVED, "/.well-known/oauth-protected-resource")).json()) as Record<string, unknown>;
      expect(root).toMatchObject({ resource: SERVED, authorization_servers: [SERVED] });

      const endpoint = createMcpEndpoint({ createServer: createDemoServer });
      const unauthorized = await endpoint(ctx, at(SERVED, "/api/mcp", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(listTools()) }));
      expect(unauthorized.status).toBe(401);
      expect(unauthorized.headers.get("www-authenticate")).toContain(`resource_metadata="${SERVED}/.well-known/oauth-protected-resource/api/mcp"`);
    });

    it("runs register → consent decision → token with the served origin as Origin, iss and resource", async () => {
      const { ctx } = await start(fromHost);
      const alice = await createUser(test!.database, "alice@example.com");
      const registered = await handleClientRegistration(
        ctx,
        at(SERVED, "/api/oauth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ redirect_uris: [REDIRECT_URI], token_endpoint_auth_method: "none" }) }),
      );
      const clientId = ((await registered.json()) as { client_id: string }).client_id;
      const params = new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        redirect_uri: REDIRECT_URI,
        state: "s",
        code_challenge: getCodeChallenge(VERIFIER),
        code_challenge_method: "S256",
        resource: `${SERVED}/api/mcp`,
        decision: "allow",
      });

      const elsewhere = await handleAuthorizationDecision(ctx, at(SERVED, "/api/oauth/authorize", { method: "POST", headers: { ...FORM, origin: CONFIGURED }, body: params.toString() }), alice);
      expect(elsewhere.status).toBe(403);
      const decided = await handleAuthorizationDecision(ctx, at(SERVED, "/api/oauth/authorize", { method: "POST", headers: { ...FORM, origin: SERVED }, body: params.toString() }), alice);
      expect(decided.status).toBe(303);
      const location = new URL(decided.headers.get("location") ?? "");
      expect(location.searchParams.get("iss")).toBe(SERVED);

      const token = await handleTokenRequest(
        ctx,
        at(SERVED, "/api/oauth/token", {
          method: "POST",
          headers: FORM,
          body: new URLSearchParams({ grant_type: "authorization_code", code: location.searchParams.get("code") ?? "", code_verifier: VERIFIER, client_id: clientId, resource: `${SERVED}/api/mcp` }).toString(),
        }),
      );
      expect(token.status).toBe(200);
      expect(((await token.json()) as { token_type: string }).token_type).toBe("Bearer");
    });

    it("validates the consent page's request against the same origins", async () => {
      const { ctx } = await start(fromHost);
      const { client } = await registerMcpClient(ctx, { clientName: "Assistant", redirectUris: [REDIRECT_URI], tokenEndpointAuthMethod: "none" });
      const params = new URLSearchParams({ response_type: "code", client_id: client.clientId, redirect_uri: REDIRECT_URI, code_challenge: getCodeChallenge(VERIFIER), code_challenge_method: "S256", resource: SERVED });
      const served = resolveMcpOrigins(ctx.config, at(SERVED, "/oauth/authorize"));
      expect((await validateAuthorizationRequest(ctx, params, served)).kind).toBe("valid");
      const refused = await validateAuthorizationRequest(ctx, params);
      expect(refused.kind).toBe("redirect-error");
      expect(refused.kind === "redirect-error" ? new URL(refused.location).searchParams.get("iss") : null).toBe(CONFIGURED);
    });
  });

  describe("a second public host (resourceOrigins)", () => {
    const twoHosts: McpAccessOptionsInput = { ...OAUTH_OPTIONS, resourceOrigins: [`${APEX}/`] };

    it("announces the host the root document was asked on, and the app origin elsewhere", async () => {
      const config = createConfig(twoHosts);
      const rootAt = async (origin: string) =>
        (await serveDiscoveryDocument(config, getRootProtectedResourceMetadata, at(origin, "/.well-known/oauth-protected-resource")).json()) as Record<string, unknown>;
      expect(await rootAt(APEX)).toMatchObject({ resource: APEX, authorization_servers: [CONFIGURED] });
      expect(await rootAt(APP)).toMatchObject({ resource: CONFIGURED });
      expect(await rootAt("http://example.test")).toMatchObject({ resource: APEX });
      expect(getProtectedResourceMetadata(config, "endpoint").resource).toBe(`${CONFIGURED}/api/mcp`);
    });

    it("accepts the extra host as resource, with or without a slash, and nothing else new", () => {
      const config = createConfig(twoHosts);
      for (const resource of [APEX, `${APEX}/`, CONFIGURED, `${CONFIGURED}/api/mcp`]) expect(isAcceptableResource(config, resource)).toBe(true);
      for (const resource of [`${APEX}/api/mcp`, "https://other.test", APP]) expect(isAcceptableResource(config, resource)).toBe(false);
    });

    it("lets the token endpoint take the apex as resource", async () => {
      const { ctx } = await start(twoHosts);
      const { client } = await registerMcpClient(ctx, { clientName: "Assistant", redirectUris: [REDIRECT_URI], tokenEndpointAuthMethod: "none" });
      const request = (resource: string) =>
        handleTokenRequest(ctx, at(APEX, "/api/oauth/token", { method: "POST", headers: FORM, body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: "x", client_id: client.clientId, resource }).toString() }));
      expect(((await (await request(APEX)).json()) as { error: string }).error).toBe("invalid_grant");
      expect(((await (await request("https://other.test")).json()) as { error: string }).error).toBe("invalid_target");
    });

    it("refuses origins with a path, a query or another scheme, and more than 16", () => {
      for (const origin of [`${APEX}/x`, `${APEX}?a=1`, "ftp://example.test", "example.test"]) {
        expect(() => createConfig({ ...OAUTH_OPTIONS, resourceOrigins: [origin] })).toThrow(/http\(s\) origin/);
      }
      const many = Array.from({ length: 17 }, (_, index) => `https://h${index}.example.test`);
      expect(() => createConfig({ ...OAUTH_OPTIONS, resourceOrigins: many })).toThrow(/at most 16/);
    });
  });

  describe("discovery caching", () => {
    it("varies the documents by Host and X-Forwarded-Proto", () => {
      const served = serveDiscoveryDocument(createConfig(OAUTH_OPTIONS), getRootProtectedResourceMetadata, at(APP, "/.well-known/oauth-protected-resource"));
      expect(served.headers.get("vary")).toBe("host, x-forwarded-proto");
      expect(served.headers.get("cache-control")).toBe("public, max-age=300");
    });
  });
});

describe("discovery metadata extensions (#234)", () => {
  it("adds the app's static keys to both documents", () => {
    const config = createConfig({
      ...OAUTH_OPTIONS,
      oauth: {
        enabled: true,
        metadata: {
          authorizationServer: { jwks_uri: `${CONFIGURED}/.well-known/jwks.json`, service_documentation: `${CONFIGURED}/docs` },
          protectedResource: { resource_documentation: `${CONFIGURED}/docs`, resource_name: "Acme MCP server" },
        },
      },
    });
    expect(getAuthorizationServerMetadata(config)).toMatchObject({ issuer: CONFIGURED, jwks_uri: `${CONFIGURED}/.well-known/jwks.json`, service_documentation: `${CONFIGURED}/docs` });
    expect(getProtectedResourceMetadata(config, "endpoint")).toMatchObject({ resource: `${CONFIGURED}/api/mcp`, resource_documentation: `${CONFIGURED}/docs`, resource_name: "Acme MCP server" });
  });

  it("computes keys from the request's origins, and the generated keys win", () => {
    const seen: McpOrigins[] = [];
    const config = createConfig({
      ...OAUTH_OPTIONS,
      resolveAppOrigin: readRequestOrigin,
      oauth: {
        enabled: true,
        metadata: {
          authorizationServer: (origins) => {
            seen.push(origins);
            return { issuer: "https://evil.test", agent_auth: { register_uri: `${origins.appOrigin}/api/oauth/register` } };
          },
          protectedResource: () => ({ resource: "https://evil.test", authorization_servers: ["https://evil.test"] }),
        },
      },
    });
    const origins = resolveMcpOrigins(config, at(SERVED, "/"));
    expect(getAuthorizationServerMetadata(config, origins)).toMatchObject({ issuer: SERVED, agent_auth: { register_uri: `${SERVED}/api/oauth/register` } });
    expect(seen).toEqual([{ appOrigin: SERVED, resourceOrigins: [] }]);
    expect(getProtectedResourceMetadata(config, "root", origins)).toMatchObject({ resource: SERVED, authorization_servers: [SERVED], resource_name: "acme" });
  });

  it("refuses a static extension that sets a generated key, by name", () => {
    expect(() => createConfig({ ...OAUTH_OPTIONS, oauth: { enabled: true, metadata: { authorizationServer: { issuer: "https://evil.test" } } } })).toThrow(/"issuer" is generated/);
    expect(() => createConfig({ ...OAUTH_OPTIONS, oauth: { enabled: true, metadata: { protectedResource: { resource: "https://evil.test" } } } })).toThrow(/"resource" is generated/);
    expect(() => mcpAccess({ ...OAUTH_OPTIONS, oauth: { enabled: true, metadata: { authorizationServer: "nope" as unknown as Record<string, unknown> } } })).toThrow();
  });
});

describe("exports for apps composing from /server (#234)", () => {
  it("builds a working context from the configuration and types the client row from the root", async () => {
    const config = createConfig({ ...OAUTH_OPTIONS });
    const test = await createTestMcp(config);
    try {
      await expect(createMcpAccessContext({ ...config, database: null })).rejects.toThrow(/has no database/);
      const built = await createMcpAccessContext(config);
      expect(built.config).toBe(config);
      expect(built.clock.now()).toBeInstanceOf(Date);
      const alice = await createUser(test.database, "alice@example.com");
      const issued = await issueAccessToken(test.ctx, { userId: alice, name: "cli", canWrite: false });
      expect(issued.ok).toBe(true);
      const { client } = await registerMcpClient(test.ctx, { clientName: "Assistant", redirectUris: [REDIRECT_URI], tokenEndpointAuthMethod: "none" });
      const found: OAuthClientRow | null = await findOAuthClient(test.ctx, client.clientId);
      expect(found?.clientName).toBe("Assistant");
    } finally {
      await test.database.close();
    }
  });
});


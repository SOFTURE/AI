// OAuth discovery: the keys agent-ready adds to the issuer's documents, and auth.md, checked against
// @softure-ai/mcp-access's real builders so the two cannot drift.
import {
  agentReady,
  buildAgentAuthMetadata,
  buildAuthMd,
  buildResourceDocumentation,
  createAgentAuthExtension,
  createOrigins,
  EMPTY_JWKS,
  getResourceMetadataUrl,
  listMetadataUrls,
  resolveDocumentContext,
  type AgentReadyOptionsInput,
} from "@softure-ai/agent-ready";
import { auth } from "@softure-ai/auth";
import { defineSoftureConfig } from "@softure-ai/core";
import { mcpAccess, MCP_RATE_LIMIT_BUCKETS } from "@softure-ai/mcp-access";
import { headerIp, security } from "@softure-ai/security";
import { createIssuerRequest } from "@softure-ai/agent-ready/next";
import { getProtectedResourceMetadata, resolveMcpOrigins } from "@softure-ai/mcp-access/server";
import { describe, expect, it } from "vitest";
import { APEX, APP, BASE_OPTIONS, createContext, createIssuerConfig, createIssuerProvider, createRequest } from "./support.js";

describe("the authorization server additions", () => {
  it("adds jwks_uri on the app host, documentation and auth.md on the apex", () => {
    expect(buildAgentAuthMetadata({ appOrigin: `${APP}/`, apexOrigin: APEX, registrationEndpoint: `${APP}/api/oauth/register` })).toEqual({
      jwks_uri: `${APP}/.well-known/jwks.json`,
      service_documentation: `${APEX}/`,
      agent_auth: { skill: `${APEX}/auth.md`, register_uri: `${APP}/api/oauth/register` },
    });
    expect(buildResourceDocumentation(APEX, "/assistant")).toEqual({ resource_documentation: `${APEX}/assistant` });
    expect(getResourceMetadataUrl(APP, "/api/mcp")).toBe(`${APP}/.well-known/oauth-protected-resource/api/mcp`);
    expect(EMPTY_JWKS).toEqual({ keys: [] });
  });

  it("goes into mcp-access's metadata with register_uri equal to its registration_endpoint", () => {
    const config = createIssuerConfig();
    const metadata = createIssuerProvider(config)(createIssuerRequest(APP));
    expect(metadata).toMatchObject({ issuer: APP, jwks_uri: `${APP}/.well-known/jwks.json`, service_documentation: `${APEX}/` });
    expect(metadata.agent_auth).toEqual({ skill: `${APEX}/auth.md`, register_uri: metadata.registration_endpoint });
  });

  it("follows the request's app origin when the issuer resolves it per request", () => {
    const extension = createAgentAuthExtension({ apexOrigin: APEX, registerPath: "/oauth/register" });
    expect(extension({ appOrigin: "https://other.example.com" }).agent_auth.register_uri).toBe("https://other.example.com/oauth/register");
    const config = createIssuerConfig(APP, { resolveAppOrigin: (request) => new URL(request.url).origin });
    const metadata = createIssuerProvider(config)(createIssuerRequest("https://staging.example.com"));
    expect(metadata.issuer).toBe("https://staging.example.com");
    expect(metadata.jwks_uri).toBe("https://staging.example.com/.well-known/jwks.json");
  });

  it("names the apex as resource in the root metadata when mcp-access lists it in resourceOrigins", () => {
    const config = createIssuerConfig();
    const root = getProtectedResourceMetadata(config, "root", resolveMcpOrigins(config), APEX);
    expect(root).toMatchObject({ resource: APEX, authorization_servers: [APP], resource_documentation: `${APEX}/` });
  });
});

describe("auth.md", () => {
  const config = createIssuerConfig();
  const metadata = createIssuerProvider(config)(createIssuerRequest(APP));
  const context = createContext({
    oauth: { authorizationServerMetadata: () => metadata, manualTokenPath: "/mcp", lifetimes: { authorizationCodeMinutes: 10, accessTokenMinutes: 60, refreshTokenDays: 90 } },
  });
  const document = buildAuthMd(context, metadata);

  it("has auth.md in its H1 and every section an agent follows", () => {
    expect(document.startsWith("# auth.md: Example\n")).toBe(true);
    expect(document.match(/^## .+$/gm)).toEqual([
      "## Discover",
      "## Endpoints",
      "## Pick a method",
      "## Register",
      "## Authorize",
      "## Exchange",
      "## Use the access token",
      "## Errors",
      "## Revocation",
    ]);
  });

  it("lists every URL of mcp-access's metadata, so the document and the server cannot drift", () => {
    const urls = listMetadataUrls(metadata);
    expect(urls.map(({ key }) => key).sort()).toEqual(["authorization_endpoint", "issuer", "jwks_uri", "registration_endpoint", "token_endpoint"]);
    for (const { key, url } of urls) expect(document, key).toContain(`- \`${key}\`: \`${url}\``);
    expect(document).toContain(`\`POST ${String(metadata.token_endpoint)}\``);
    expect(document).toContain(`resource_metadata="${APP}/.well-known/oauth-protected-resource/api/mcp"`);
  });

  it("states the configured lifetimes and the manual token page, and claims no agentic registration", () => {
    expect(document).toContain("expires after 10 minutes");
    expect(document).toContain("`expires_in`: 3600");
    expect(document).toContain("A refresh token lives 90 days.");
    expect(document).toContain(`\`${APP}/mcp\``);
    expect(document).toContain("is **not supported**");
  });

  it("leaves lifetimes out when the app sets none", () => {
    const plain = buildAuthMd(createContext({ oauth: { authorizationServerMetadata: () => metadata } }), metadata);
    expect(plain).not.toContain("expires after");
    expect(plain).not.toContain("Manual token");
  });

  it("works for a single host as well", () => {
    const single = buildAuthMd({ ...context, origins: createOrigins(APP) }, metadata);
    expect(single).toContain(`More for people: ${APP}/`);
  });
});

describe("lifetimes from mcp-access (#316)", () => {
  const metadata = createIssuerProvider(createIssuerConfig())(createIssuerRequest(APP));
  const oauth = { authorizationServerMetadata: () => metadata };

  function buildDocument(agentOptions: Partial<AgentReadyOptionsInput>, oauthEnabled: boolean): string {
    const config = defineSoftureConfig({
      database: { url: "pglite://" },
      locale: "en",
      timezone: "Europe/Warsaw",
      appOrigin: APP,
      modules: [
        security({ clientIp: headerIp("x-real-ip"), buckets: { ...MCP_RATE_LIMIT_BUCKETS } }),
        auth({}),
        mcpAccess({
          serverName: "example",
          oauth: { enabled: oauthEnabled, authorizationCodeLifetimeMinutes: 5, accessTokenLifetimeMinutes: 30, refreshTokenLifetimeDays: 7 },
        }),
        agentReady({ ...BASE_OPTIONS, ...agentOptions }),
      ],
    });
    return buildAuthMd(resolveDocumentContext(config, createRequest("/auth.md", "app.example.com")), metadata);
  }

  it("states mcp-access's lifetimes when agent-ready sets none", () => {
    const document = buildDocument({ oauth }, true);
    expect(document).toContain("expires after 5 minutes");
    expect(document).toContain("`expires_in`: 1800");
    expect(document).toContain("A refresh token lives 7 days.");
  });

  it("keeps lifetimes set in agent-ready", () => {
    const lifetimes = { authorizationCodeMinutes: 10, accessTokenMinutes: 60, refreshTokenDays: 90 };
    expect(buildDocument({ oauth: { ...oauth, lifetimes } }, true)).toContain("expires after 10 minutes");
  });

  it("states none when mcp-access runs no OAuth", () => {
    expect(buildDocument({ oauth }, false)).not.toContain("expires after");
  });
});

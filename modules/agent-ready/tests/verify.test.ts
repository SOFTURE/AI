// The deploy verify manifest: valid for `deploy.json`, and every route it lists for a document this package serves
// passes against the real handler, so the manifest checks what the routes actually answer.
import { agentReady, buildHomeLinkHeader, buildVerifyManifest, skillPath, type AgentReadyOptionsInput, type VerifyRoute } from "@softure-ai/agent-ready";
import {
  serveA2aAgentCard,
  serveAgentSkill,
  serveAgentSkillsIndex,
  serveAiCatalog,
  serveApiCatalog,
  serveAuthMd,
  serveJwks,
  serveMcpServerCard,
  serveOpenApi,
  serveSignatureDirectory,
} from "@softure-ai/agent-ready/next";
import { checkResponse, parseDeployConfig } from "@softure-ai/deploy";
import { createTestClock } from "@softure-ai/core";
import { createTestDatabase } from "@softure-ai/db/testing";
import {
  createMcpEndpoint,
  getAuthorizationServerMetadata,
  getProtectedResourceMetadata,
  getRootProtectedResourceMetadata,
  serveDiscoveryDocument,
} from "@softure-ai/mcp-access/server";
import { defineSoftureConfig } from "@softure-ai/core";
import { clearSoftureConfig, registerSoftureConfig } from "@softure-ai/core/next";
import { afterEach, describe, expect, it, vi } from "vitest";
import { APEX, APP, BASE_OPTIONS, createDemoServer, createIssuerConfig, createIssuerProvider, createRequest } from "./support.js";

const OPTIONS: AgentReadyOptionsInput = {
  ...BASE_OPTIONS,
  appOrigin: APP,
  apexOrigin: APEX,
  oauth: { authorizationServerMetadata: createIssuerProvider(createIssuerConfig()) },
  skills: [{ name: "notes", description: "Work with notes.", body: () => "\nNotes.\n" }],
  markdown: true,
};
const ORIGINS = { appOrigin: APP, apexOrigin: APEX };

const HANDLERS: Record<string, (request: Request) => Promise<Response>> = {
  "/.well-known/api-catalog": serveApiCatalog,
  "/openapi.json": serveOpenApi,
  "/auth.md": serveAuthMd,
  "/.well-known/jwks.json": serveJwks,
  "/.well-known/mcp/server-card.json": serveMcpServerCard,
  "/.well-known/agent-card.json": serveA2aAgentCard,
  "/.well-known/agent-skills/index.json": serveAgentSkillsIndex,
  "/.well-known/ai-catalog.json": serveAiCatalog,
  "/.well-known/http-message-signatures-directory": serveSignatureDirectory,
  [skillPath("notes")]: (request) => serveAgentSkill(request, { params: Promise.resolve({ name: "notes" }) }),
  [skillPath("app-mcp")]: (request) => serveAgentSkill(request, { params: Promise.resolve({ name: "app-mcp" }) }),
};

afterEach(() => {
  clearSoftureConfig();
  vi.unstubAllEnvs();
});

function parseRoutes(routes: readonly VerifyRoute[]) {
  const parsed = parseDeployConfig({ verify: { routes } });
  if (!parsed.ok) throw new Error(parsed.issues.join("\n"));
  // The manifest has no forEach routes, so every route keeps its path.
  return (parsed.config.verify?.routes ?? []).flatMap((route) => (route.path === undefined ? [] : [{ ...route, path: route.path }]));
}

describe("buildVerifyManifest", () => {
  it("is a valid verify section of deploy.json", () => {
    const options = agentReady(OPTIONS).options;
    expect(parseRoutes(buildVerifyManifest({ host: "apex", options, origins: ORIGINS, signatureDirectory: true, webMcp: true })).length).toBe(16);
    expect(parseRoutes(buildVerifyManifest({ host: "app", options, origins: ORIGINS })).map((route) => `${route.method} ${route.path} ${route.status}`)).toEqual([
      "POST /api/mcp 401",
      "GET /.well-known/jwks.json 200",
      "GET /.well-known/oauth-authorization-server 200",
      "GET /.well-known/oauth-protected-resource/api/mcp 200",
    ]);
  });

  it("checks one Link rel per route, since verify takes one marker per header", () => {
    const routes = buildVerifyManifest({ host: "apex", options: agentReady(OPTIONS).options, origins: ORIGINS }).filter((route) => route.path === "/");
    expect(routes.map((route) => route.headers?.link)).toEqual(['rel="api-catalog"', 'rel="service-desc"', 'rel="service-doc"', 'rel="describedby"']);
    for (const route of parseRoutes(routes)) {
      const outcomes = checkResponse({ route, headers: route.headers, baseUrl: APEX, response: { requestUrl: `${APEX}/`, status: 200, getHeader: (name) => (name === "link" ? buildHomeLinkHeader({ markdown: true }) : null), body: "" } });
      expect(outcomes.every((outcome) => outcome.passed)).toBe(true);
    }
  });

  it("holds every route for both hosts when the app runs on one", () => {
    const options = agentReady({ ...BASE_OPTIONS, oauth: OPTIONS.oauth }).options;
    const single = buildVerifyManifest({ host: "apex", options, origins: { appOrigin: APEX, apexOrigin: APEX } });
    expect(single.map((route) => route.path)).toContain("/api/mcp");
    expect(single.map((route) => route.path)).toContain("/.well-known/api-catalog");
  });

  it("passes against the real handlers for every document this package serves", async () => {
    vi.stubEnv("WEB_BOT_AUTH_PRIVATE_KEY", "n4Ni-HpISpVObnQMW0wOhCKROaIKqKtW_2ZYb2p9KcU");
    registerSoftureConfig(defineSoftureConfig({ locale: "en", timezone: "Europe/Warsaw", appOrigin: APP, modules: [agentReady(OPTIONS)] }));
    const options = agentReady(OPTIONS).options;
    const routes = parseRoutes([
      ...buildVerifyManifest({ host: "apex", options, origins: ORIGINS, signatureDirectory: true }),
      ...buildVerifyManifest({ host: "app", options, origins: ORIGINS }),
    ]);
    const checked: string[] = [];
    for (const route of routes) {
      const handler = HANDLERS[route.path];
      if (handler === undefined) continue;
      const host = route.path === "/.well-known/jwks.json" ? "app.example.com" : "example.com";
      const response = await handler(createRequest(route.path, host));
      const body = await response.text();
      const outcomes = checkResponse({
        route,
        headers: route.headers,
        baseUrl: `https://${host}`,
        response: { requestUrl: `https://${host}${route.path}`, status: response.status, getHeader: (name) => response.headers.get(name), body },
      });
      expect(outcomes.filter((outcome) => !outcome.passed), route.path).toEqual([]);
      checked.push(route.path);
    }
    expect(checked.length).toBe(11);
  });

  it("passes against the issuer's real handlers for the routes @softure-ai/mcp-access serves", async () => {
    const config = createIssuerConfig();
    const database = await createTestDatabase(config.modules);
    try {
      const endpoint = createMcpEndpoint({ createServer: () => createDemoServer() });
      const ctx = { db: database.db, clock: createTestClock(new Date("2026-10-08T12:00:00Z")), config };
      const serveIssuer: Record<string, (request: Request) => Response | Promise<Response>> = {
        "/api/mcp": (request) => endpoint(ctx, request),
        "/.well-known/oauth-authorization-server": (request) => serveDiscoveryDocument(config, (c, origins) => getAuthorizationServerMetadata(c, origins), request),
        "/.well-known/oauth-protected-resource": (request) => serveDiscoveryDocument(config, getRootProtectedResourceMetadata, request),
        "/.well-known/oauth-protected-resource/api/mcp": (request) => serveDiscoveryDocument(config, (c, origins) => getProtectedResourceMetadata(c, "endpoint", origins), request),
      };
      const options = agentReady(OPTIONS).options;
      const routes = parseRoutes([...buildVerifyManifest({ host: "apex", options, origins: ORIGINS }), ...buildVerifyManifest({ host: "app", options, origins: ORIGINS })]);
      const checked: string[] = [];
      for (const route of routes) {
        const handler = serveIssuer[route.path];
        if (handler === undefined) continue;
        const host = route.path === "/.well-known/oauth-protected-resource" ? "example.com" : "app.example.com";
        const request = createRequest(route.path, host, "https", {
          method: route.method,
          ...(route.body === undefined ? {} : { body: route.body }),
          headers: { ...route.requestHeaders, "x-real-ip": "203.0.113.7" },
        });
        const response = await handler(request);
        const body = await response.text();
        const outcomes = checkResponse({
          route,
          headers: route.headers,
          baseUrl: `https://${host}`,
          response: { requestUrl: `https://${host}${route.path}`, status: response.status, getHeader: (name) => response.headers.get(name), body },
        });
        expect(outcomes.filter((outcome) => !outcome.passed), route.path).toEqual([]);
        checked.push(`${route.method} ${route.path}`);
      }
      expect(checked.sort()).toEqual([
        "GET /.well-known/oauth-authorization-server",
        "GET /.well-known/oauth-protected-resource",
        "GET /.well-known/oauth-protected-resource/api/mcp",
        "POST /api/mcp",
      ]);
    } finally {
      await database.close();
    }
  });

  it("tells the root resource apart from the issuer on a single host", () => {
    const options = agentReady({ ...BASE_OPTIONS, oauth: OPTIONS.oauth }).options;
    const root = buildVerifyManifest({ host: "app", options, origins: { appOrigin: APP, apexOrigin: APP } }).find((route) => route.path === "/.well-known/oauth-protected-resource");
    expect(root?.contains).toEqual([`"resource":"${APP}"`]);
    expect(`{"resource":"${APP}/api/mcp","authorization_servers":["${APP}"]}`).not.toContain(root?.contains?.[0] ?? "");
  });
});

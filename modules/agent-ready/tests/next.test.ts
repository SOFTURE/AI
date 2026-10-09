// The route handlers as an app mounts them: the registered config, the request's host, the headers every document
// carries, and the origin matrix (apex and app host, with and without configured origins, behind a proxy).
import { agentReady, digestOf, type AgentReadyOptionsInput } from "@softure-ai/agent-ready";
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
import { expectCardToolsMatchServer, expectNoAccountData, expectOriginMatrix } from "@softure-ai/agent-ready/testing";
import { verifyDirectorySignature } from "@softure-ai/agent-ready/server";
import { defineSoftureConfig } from "@softure-ai/core";
import { clearSoftureConfig, registerSoftureConfig } from "@softure-ai/core/next";
import { afterEach, describe, expect, it, vi } from "vitest";
import { APEX, APP, BASE_OPTIONS, createDemoServer, createIssuerConfig, createIssuerProvider, createRequest } from "./support.js";

const RFC_SEED = "n4Ni-HpISpVObnQMW0wOhCKROaIKqKtW_2ZYb2p9KcU";
const EXTERNAL = ["https://static.modelcontextprotocol.io", "https://schemas.agentskills.io", "https://modelcontextprotocol.io"];

const OAUTH_OPTIONS: Partial<AgentReadyOptionsInput> = {
  appOrigin: APP,
  apexOrigin: APEX,
  oauth: { authorizationServerMetadata: createIssuerProvider(createIssuerConfig()), manualTokenPath: "/mcp" },
  skills: [{ name: "notes", description: "Work with notes.", body: (origins) => `\nNotes live at ${origins.apexOrigin}/notes.\n` }],
};

function register(options: Partial<AgentReadyOptionsInput> = {}, appOrigin = APP, origins?: { trustedOrigins?: string[]; trustRequestHost?: boolean }): void {
  registerSoftureConfig(defineSoftureConfig({ locale: "en", timezone: "Europe/Warsaw", appOrigin, origins, modules: [agentReady({ ...BASE_OPTIONS, ...options })] }));
}

function get(path: string, host = "example.com"): Request {
  return createRequest(path, host);
}

async function readJson(response: Response): Promise<unknown> {
  return JSON.parse(await response.text()) as unknown;
}

afterEach(() => {
  clearSoftureConfig();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("every document", () => {
  it("answers with its type, CORS for browser agents and a cache that varies with the host", async () => {
    register(OAUTH_OPTIONS);
    const cases: Array<[Promise<Response>, string, string]> = [
      [serveApiCatalog(get("/.well-known/api-catalog")), 'application/linkset+json; profile="https://www.rfc-editor.org/info/rfc9727"', "max-age=3600"],
      [serveOpenApi(get("/openapi.json")), "application/json", "max-age=3600"],
      [serveAuthMd(get("/auth.md")), "text/markdown; charset=utf-8", "max-age=3600"],
      [serveJwks(get("/.well-known/jwks.json", "app.example.com")), "application/json", "max-age=3600"],
      [serveMcpServerCard(get("/.well-known/mcp/server-card.json")), "application/json", "max-age=3600"],
      [serveA2aAgentCard(get("/.well-known/agent-card.json")), "application/json", "max-age=3600"],
      [serveAgentSkillsIndex(get("/.well-known/agent-skills/index.json")), "application/json", "max-age=300"],
      [serveAiCatalog(get("/.well-known/ai-catalog.json")), "application/json", "max-age=300"],
    ];
    for (const [pending, type, cache] of cases) {
      const response = await pending;
      expect(response.status, type).toBe(200);
      expect(response.headers.get("content-type")).toBe(type);
      expect(response.headers.get("access-control-allow-origin")).toBe("*");
      expect(response.headers.get("cache-control")).toBe(`public, ${cache}`);
      expect(response.headers.get("vary")).toBe("host, x-forwarded-host, x-forwarded-proto");
      const text = await response.text();
      expect(text.endsWith("\n")).toBe(true);
      if (type.includes("json")) expect(text).toBe(`${JSON.stringify(JSON.parse(text), null, 2)}\n`);
    }
  });
});

describe("the origin matrix", () => {
  it("puts MCP and OAuth on the app host and documents on the apex, whichever host is asked", async () => {
    register(OAUTH_OPTIONS);
    for (const host of ["example.com", "app.example.com"]) {
      const card = (await readJson(await serveMcpServerCard(get("/.well-known/mcp/server-card.json", host)))) as { remotes: Array<{ url: string }>; websiteUrl: string };
      expect(card.remotes[0]?.url).toBe(`${APP}/api/mcp`);
      expect(card.websiteUrl).toBe(APEX);
      expectOriginMatrix(card, { appOrigin: APP, apexOrigin: APEX, external: EXTERNAL });
      expectOriginMatrix(await readJson(await serveAiCatalog(get("/.well-known/ai-catalog.json", host))), { appOrigin: APP, apexOrigin: APEX });
      expectOriginMatrix(await readJson(await serveOpenApi(get("/openapi.json", host))), { appOrigin: APP, apexOrigin: APEX, external: EXTERNAL });
    }
  });

  it("falls back to the config's appOrigin, then to the request, never to the listening address", async () => {
    register({}, "https://configured.example.net");
    const card = (await readJson(await serveMcpServerCard(get("/.well-known/mcp/server-card.json", "example.com")))) as { remotes: Array<{ url: string }> };
    expect(card.remotes[0]?.url).toBe("https://configured.example.net/api/mcp");
    register({ resolveAppOrigin: (request) => `https://${request.headers.get("host") ?? ""}` });
    const resolved = await readJson(await serveApiCatalog(get("/.well-known/api-catalog", "staging.example.org")));
    expect(JSON.stringify(resolved)).toContain("https://staging.example.org/api/mcp");
    expect(JSON.stringify(resolved)).not.toContain("0.0.0.0");
  });

  it("takes the app origin from the config's origins block without a resolveAppOrigin option (#311)", async () => {
    register({}, APP, { trustedOrigins: ["https://staging.example.org"] });
    const endpointOf = async (host: string) => JSON.stringify(await readJson(await serveApiCatalog(get("/.well-known/api-catalog", host))));
    expect(await endpointOf("staging.example.org")).toContain("https://staging.example.org/api/mcp");
    expect(await endpointOf("evil.example")).toContain(`${APP}/api/mcp`);
    expect(await endpointOf("evil.example")).not.toContain("evil.example/api/mcp");
    register({}, APP, { trustRequestHost: true });
    expect(await endpointOf("preview.example.net")).toContain("https://preview.example.net/api/mcp");
  });

  it("answers 500 and logs by name when resolveAppOrigin returns something other than an origin, or Host is malformed", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    register({ resolveAppOrigin: () => "https://example.com/path" });
    const response = await serveApiCatalog(get("/.well-known/api-catalog"));
    expect(response.status).toBe(500);
    expect(String(log.mock.calls[0]?.[0])).toContain('resolveAppOrigin returned "https://example.com/path"');
    register();
    expect((await serveApiCatalog(get("/.well-known/api-catalog", "bad host"))).status).toBe(500);
  });

  it("refuses to serve OAuth documents when the issuer is on another origin than the app origin", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    register({ ...OAUTH_OPTIONS, oauth: { authorizationServerMetadata: () => ({ issuer: APEX }) } });
    expect((await serveAuthMd(get("/auth.md"))).status).toBe(500);
    expect(String(log.mock.calls[0]?.[0])).toContain(`the issuer ${APEX} is not the app origin ${APP}`);
  });
});

describe("the cards and skills follow the server", () => {
  it("list exactly the server's tools, and a tool added to the server appears everywhere", async () => {
    register({ mcp: { server: () => createDemoServer(["get_history"]) } });
    const card = (await readJson(await serveMcpServerCard(get("/.well-known/mcp/server-card.json")))) as { tools: Array<{ name: string }> };
    const a2a = (await readJson(await serveA2aAgentCard(get("/.well-known/agent-card.json")))) as { skills: Array<{ id: string }> };
    const server = { protocolVersion: "x", serverInfo: { name: "x", version: "x" }, capabilities: {}, tools: [{ name: "get_summary" }, { name: "add_note" }, { name: "get_history" }] };
    expectCardToolsMatchServer(card, server);
    expectCardToolsMatchServer(a2a, server);
    const skill = await serveAgentSkill(get("/.well-known/agent-skills/app-mcp/SKILL.md"), { params: Promise.resolve({ name: "app-mcp" }) });
    expect(await skill.text()).toContain("- `get_history`: The get_history tool.");
  });

  it("serve skill files whose bytes match the index's digests, and 404 for an unknown name", async () => {
    register(OAUTH_OPTIONS);
    const index = (await readJson(await serveAgentSkillsIndex(get("/.well-known/agent-skills/index.json")))) as { skills: Array<{ name: string; digest: string }> };
    expect(index.skills.map((skill) => skill.name)).toEqual(["notes", "app-mcp"]);
    for (const entry of index.skills) {
      const response = await serveAgentSkill(get(`/.well-known/agent-skills/${entry.name}/SKILL.md`), { params: Promise.resolve({ name: entry.name }) });
      expect(response.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
      expect(digestOf(await response.text())).toBe(entry.digest);
    }
    const missing = await serveAgentSkill(get("/.well-known/agent-skills/nope/SKILL.md"), { params: Promise.resolve({ name: "nope" }) });
    expect(missing.status).toBe(404);
    expect(missing.headers.get("cache-control")).toBe("no-store");
  });

  it("answer an unknown or an app skill without building the MCP server", async () => {
    const server = vi.fn(() => createDemoServer());
    register({ ...OAUTH_OPTIONS, mcp: { server } });
    expect((await serveAgentSkill(get("/x"), { params: Promise.resolve({ name: "nope" }) })).status).toBe(404);
    expect((await serveAgentSkill(get("/x"), { params: Promise.resolve({ name: "notes" }) })).status).toBe(200);
    expect(server).not.toHaveBeenCalled();
  });

  it("carry no account data: the server is built anonymously and no tool is called", async () => {
    register({ mcp: { server: () => createDemoServer() } });
    const card = await readJson(await serveMcpServerCard(get("/.well-known/mcp/server-card.json")));
    expectNoAccountData(card, ["account-42", "noted:"]);
  });

  it("answer 500 without internals when the server cannot be built, and log the cause", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    register({
      mcp: {
        server: () => {
          throw new Error("database is down");
        },
      },
    });
    const response = await serveMcpServerCard(get("/.well-known/mcp/server-card.json"));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "discovery_document_unavailable" });
    expect(String(log.mock.calls[0]?.[0])).toContain("@softure-ai/agent-ready: building the MCP server card failed");
  });
});

describe("OAuth documents", () => {
  it("serve auth.md and the JWKS with OAuth, 404 without", async () => {
    register(OAUTH_OPTIONS);
    expect(await (await serveAuthMd(get("/auth.md"))).text()).toContain(`\`POST ${APP}/api/oauth/register\``);
    expect(await readJson(await serveJwks(get("/.well-known/jwks.json")))).toEqual({ keys: [] });
    register();
    expect((await serveAuthMd(get("/auth.md"))).status).toBe(404);
    expect((await serveJwks(get("/.well-known/jwks.json"))).status).toBe(404);
  });

  it("hand the issuer a request addressed to the resolved app origin", async () => {
    const seen: string[] = [];
    register({
      ...OAUTH_OPTIONS,
      oauth: {
        authorizationServerMetadata: (request, origins) => {
          seen.push(`${request.url} ${request.headers.get("host") ?? ""} ${origins.apexOrigin}`);
          return { issuer: APP };
        },
      },
    });
    await serveAuthMd(get("/auth.md", "example.com"));
    expect(seen).toEqual([`${APP}/.well-known/oauth-authorization-server app.example.com ${APEX}`]);
  });

  it("take the OAuth flow of OpenAPI from the issuer's endpoints", async () => {
    register(OAUTH_OPTIONS);
    const document = JSON.stringify(await readJson(await serveOpenApi(get("/openapi.json"))));
    expect(document).toContain(`"authorizationUrl":"${APP}/oauth/authorize"`);
    expect(document).toContain(`"tokenUrl":"${APP}/api/oauth/token"`);
  });
});

describe("the A2A card", () => {
  it("answers 404 when the app turns it off", async () => {
    register({ a2a: { enabled: false } });
    expect((await serveA2aAgentCard(get("/.well-known/agent-card.json"))).status).toBe(404);
  });
});

describe("the signature directory", () => {
  it("answers 404 without a key, and is never cached then", async () => {
    register();
    const response = await serveSignatureDirectory(get("/.well-known/http-message-signatures-directory"));
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("serves the key signed for the host it was asked on, from the configured variable", async () => {
    vi.stubEnv("SIGNING_SEED", RFC_SEED);
    register({ webBotAuth: { privateKeyEnv: "SIGNING_SEED" } });
    const response = await serveSignatureDirectory(get("/.well-known/http-message-signatures-directory", "Example.com:443"));
    expect(response.headers.get("content-type")).toBe("application/http-message-signatures-directory+json");
    const body = await readJson(response);
    const input = { signatureInput: response.headers.get("signature-input"), signature: response.headers.get("signature"), body };
    expect(verifyDirectorySignature({ ...input, authority: "example.com" }).ok).toBe(true);
    expect(verifyDirectorySignature({ ...input, authority: "app.example.com" }).ok).toBe(false);
  });
});

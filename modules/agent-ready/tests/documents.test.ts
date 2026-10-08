// The document builders: what each one says, on which host, and from which source.
import { createHash } from "node:crypto";
import {
  buildA2aAgentCard,
  buildAgentmapDirective,
  buildAgentSkillsIndex,
  buildAiCatalog,
  buildApiCatalog,
  buildHomeLinkHeader,
  buildMcpServerCard,
  buildMcpSkill,
  buildOpenApiDocument,
  createAgentSkill,
  digestOf,
  findAgentSkill,
  getHomeLinks,
  nextHeaders,
  renderAppSkills,
  type McpServerDescription,
} from "@softure-ai/agent-ready";
import { expectOriginMatrix } from "@softure-ai/agent-ready/testing";
import { describe, expect, it } from "vitest";
import { APEX, APP, createContext } from "./support.js";

const DESCRIPTION: McpServerDescription = {
  protocolVersion: "2025-06-18",
  serverInfo: { name: "example", version: "2.4.0" },
  capabilities: { tools: {} },
  tools: [
    { name: "get_summary", title: "Summary", description: "Reads the summary.\nMore.", annotations: { readOnlyHint: true } },
    { name: "add_note", description: "Adds a note." },
  ],
};

const METADATA = {
  issuer: APP,
  authorization_endpoint: `${APP}/oauth/authorize`,
  token_endpoint: `${APP}/api/oauth/token`,
  registration_endpoint: `${APP}/api/oauth/register`,
  jwks_uri: `${APP}/.well-known/jwks.json`,
};

const EXTERNAL = ["https://static.modelcontextprotocol.io", "https://schemas.agentskills.io", "https://www.rfc-editor.org", "https://modelcontextprotocol.io"];

describe("the home page Link header", () => {
  it("lists relative links, so one header is true on every host", () => {
    expect(buildHomeLinkHeader()).toBe(
      '</.well-known/api-catalog>; rel="api-catalog"; type="application/linkset+json", ' +
        '</openapi.json>; rel="service-desc"; type="application/openapi+json", ' +
        '</>; rel="service-doc"; type="text/html"',
    );
  });

  it("adds describedby when / answers Markdown, and the service doc path when it is elsewhere", () => {
    expect(getHomeLinks({ markdown: true, serviceDocPath: "/assistant" }).map((link) => `${link.rel} ${link.href}`)).toEqual([
      "api-catalog /.well-known/api-catalog",
      "service-desc /openapi.json",
      "service-doc /assistant",
      "describedby /",
    ]);
  });

  it("gives the next.config headers rule for /", () => {
    expect(nextHeaders()).toEqual([{ source: "/", headers: [{ key: "Link", value: buildHomeLinkHeader() }] }]);
  });
});

describe("the API catalog", () => {
  it("anchors on the apex and points at the endpoint on the app host", () => {
    expect(buildApiCatalog(createContext())).toEqual({
      linkset: [
        { anchor: `${APEX}/.well-known/api-catalog`, item: [{ href: `${APP}/api/mcp`, title: "Example MCP server" }] },
        {
          anchor: `${APP}/api/mcp`,
          "service-desc": [
            { href: `${APEX}/openapi.json`, type: "application/openapi+json" },
            { href: `${APEX}/.well-known/mcp/server-card.json`, type: "application/mcp-server-card+json" },
          ],
          "service-doc": [{ href: `${APEX}/`, type: "text/html", title: "Connect an AI assistant to Example" }],
        },
      ],
    });
  });

  it("lists status only when the app opts in", () => {
    const catalog = buildApiCatalog(createContext({ apiCatalog: { statusPath: "/api/health" } }));
    expect(catalog.linkset[1]?.status).toEqual([{ href: `${APP}/api/health`, type: "application/json" }]);
  });
});

describe("the OpenAPI document", () => {
  it("describes the JSON-RPC envelope on the app host, with OAuth from the issuer's metadata", () => {
    const document = buildOpenApiDocument(createContext(), METADATA);
    expect(document.servers).toEqual([{ url: APP }]);
    expect(Object.keys(document.paths)).toEqual(["/api/mcp"]);
    expect(document.security).toEqual([{ oauth2: ["mcp:read"] }, { bearerAuth: [] }]);
    expect(document.components.securitySchemes).toMatchObject({
      oauth2: { flows: { authorizationCode: { authorizationUrl: METADATA.authorization_endpoint, tokenUrl: METADATA.token_endpoint } } },
    });
    expectOriginMatrix(document, { appOrigin: APP, apexOrigin: APEX, external: EXTERNAL });
  });

  it("names the bearer token only without OAuth", () => {
    const document = buildOpenApiDocument(createContext());
    expect(document.security).toEqual([{ bearerAuth: [] }]);
    expect(Object.keys(document.components.securitySchemes)).toEqual(["bearerAuth"]);
  });

  it("resolves every $ref", () => {
    const document = buildOpenApiDocument(createContext(), METADATA);
    const refs = JSON.stringify(document).match(/"#\/components\/schemas\/[A-Za-z]+"/g) ?? [];
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) expect(Object.keys(document.components.schemas)).toContain(ref.slice(22, -1));
  });

  it("keeps the envelope's contract pinned to openapi.version: bump both together", () => {
    const { paths, components } = buildOpenApiDocument(createContext(), METADATA);
    const digest = createHash("sha256").update(JSON.stringify({ paths, schemas: components.schemas })).digest("hex").slice(0, 16);
    expect({ version: createContext().options.openapi.version, digest }).toEqual({ version: "1.0.0", digest: "257f17cc192e82af" });
  });
});

describe("the MCP server card", () => {
  it("carries both drafts and lists the server's tools with their scopes", () => {
    const card = buildMcpServerCard(createContext(), { description: DESCRIPTION, supportedProtocolVersions: ["2025-06-18"] });
    expect(card).toMatchObject({
      $schema: "https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json",
      name: "com.example/app",
      version: "2.4.0",
      websiteUrl: APEX,
      remotes: [{ type: "streamable-http", url: `${APP}/api/mcp`, supportedProtocolVersions: ["2025-06-18"] }],
      serverInfo: { name: "example", version: "2.4.0" },
      transport: { type: "streamable-http", endpoint: `${APP}/api/mcp` },
      authentication: { required: true, schemes: ["bearer"], scopes: ["mcp:read", "mcp:write"], documentation: `${APEX}/` },
    });
    expect(card.tools).toEqual([
      { name: "get_summary", title: "Summary", description: "Reads the summary.\nMore.", annotations: { readOnlyHint: true }, requiredScopes: ["mcp:read"] },
      { name: "add_note", description: "Adds a note.", annotations: {}, requiredScopes: ["mcp:read", "mcp:write"] },
    ]);
  });

  it("points at auth.md when OAuth is configured", () => {
    const context = createContext({ oauth: { authorizationServerMetadata: () => METADATA } });
    expect(buildMcpServerCard(context, { description: DESCRIPTION, supportedProtocolVersions: [] }).documentationUrl).toBe(`${APEX}/auth.md`);
  });
});

describe("the A2A agent card", () => {
  it("has one interface with the MCP binding and a skill per tool", () => {
    const card = buildA2aAgentCard(createContext({ a2a: { skillTags: (tool) => (tool.name.startsWith("get_") ? ["summary"] : []) } }), DESCRIPTION);
    expect(card.supportedInterfaces).toEqual([{ url: `${APP}/api/mcp`, protocolBinding: "MCP", protocolVersion: "2025-06-18" }]);
    expect(card.provider).toEqual({ organization: "Example Ltd", url: APEX });
    expect(card.skills).toEqual([
      { id: "get_summary", name: "Summary", description: "Reads the summary.\nMore.", tags: ["read", "summary"] },
      { id: "add_note", name: "add_note", description: "Adds a note.", tags: ["write"] },
    ]);
  });
});

describe("Agent Skills", () => {
  it("renders the frontmatter with a JSON-quoted description", () => {
    expect(createAgentSkill("notes", 'Notes: "quick", short', "\nBody\n").markdown).toBe('---\nname: notes\ndescription: "Notes: \\"quick\\", short"\n---\n\nBody\n');
  });

  it("digests the exact UTF-8 bytes the SKILL.md route serves", () => {
    const skill = createAgentSkill("notes", "Café ☕ notes.", "\nBody\n");
    const [entry] = buildAgentSkillsIndex([skill]).skills;
    expect(entry).toEqual({ name: "notes", type: "skill-md", description: "Café ☕ notes.", url: "/.well-known/agent-skills/notes/SKILL.md", digest: digestOf(skill.markdown) });
    expect(entry?.digest).toBe(`sha256:${createHash("sha256").update(Buffer.from(skill.markdown, "utf8")).digest("hex")}`);
  });

  it("renders the app's skills for the request's origins and finds one by name", () => {
    const context = createContext({ skills: [{ name: "notes", description: "Notes.", body: (origins) => `\nSee ${origins.apexOrigin}/notes\n` }] });
    const skills = renderAppSkills(context);
    expect(skills[0]?.markdown).toContain(`See ${APEX}/notes`);
    expect(findAgentSkill(skills, "notes")).toBe(skills[0]);
    expect(findAgentSkill(skills, "missing")).toBeUndefined();
  });

  it("generates the MCP skill from the server's tools and the issuer's endpoints", () => {
    const context = createContext({ oauth: { authorizationServerMetadata: () => METADATA, manualTokenPath: "/mcp" } });
    const skill = buildMcpSkill(context, DESCRIPTION, METADATA);
    expect(skill?.name).toBe("app-mcp");
    expect(skill?.markdown).toContain("## Tools that read\n\n- `get_summary`: Reads the summary.\n");
    expect(skill?.markdown).toContain("## Tools that change data\n\n- `add_note`: Adds a note.\n");
    expect(skill?.markdown).toContain(`- token: \`POST ${METADATA.token_endpoint}\``);
    expect(skill?.markdown).toContain(`\`${APP}/mcp\``);
    const urls = (skill?.markdown.match(/https:\/\/[^\s`)]+/g) ?? []).map((url) => url.replace(/[.,;:]+$/, ""));
    expect(urls.length).toBeGreaterThan(3);
    expectOriginMatrix(urls, { appOrigin: APP, apexOrigin: APEX });
  });

  it("drops OAuth from the MCP skill without metadata, and the skill itself with mcpSkill false", () => {
    expect(buildMcpSkill(createContext(), DESCRIPTION, null)?.markdown).not.toContain("OAuth");
    expect(buildMcpSkill(createContext({ mcpSkill: false }), DESCRIPTION, null)).toBeNull();
  });
});

describe("the AI catalog", () => {
  it("points every entry at a document on the apex, with 2 to 5 queries each", () => {
    const skill = createAgentSkill("notes", "Notes.", "\n");
    const catalog = buildAiCatalog(createContext({ catalog: { queries: { mcp: ["notes MCP", "notes assistant", "my notes"] } } }), [skill]);
    expect(catalog.host).toEqual({ displayName: "Example", identifier: "example.com", documentationUrl: `${APEX}/` });
    expect(catalog.entries.map((entry) => [entry.identifier, entry.url])).toEqual([
      ["urn:air:example.com:mcp:app", `${APEX}/.well-known/mcp/server-card.json`],
      ["urn:air:example.com:a2a:app", `${APEX}/.well-known/agent-card.json`],
      ["urn:air:example.com:api:catalog", `${APEX}/.well-known/api-catalog`],
      ["urn:air:example.com:skill:notes", `${APEX}/.well-known/agent-skills/notes/SKILL.md`],
    ]);
    expect(catalog.entries[0]?.representativeQueries).toEqual(["notes MCP", "notes assistant", "my notes"]);
    for (const entry of catalog.entries) expect(entry.representativeQueries.length).toBeGreaterThanOrEqual(2);
  });

  it("leaves the A2A entry out when the card is off, and gives robots.txt its Agentmap line", () => {
    expect(buildAiCatalog(createContext({ a2a: { enabled: false } }), []).entries.map((entry) => entry.identifier)).not.toContain("urn:air:example.com:a2a:app");
    expect(buildAgentmapDirective("https://example.com/")).toEqual({ Agentmap: "https://example.com/.well-known/ai-catalog.json" });
  });
});

# @softure-ai/agent-ready

**Depends on:** core. Works next to `@softure-ai/mcp-access` (OAuth) and `@softure-ai/seo` (robots.txt, Markdown).

## 1. What it provides

Everything an AI agent uses to find an app and connect to its MCP server, built from configuration and from the
server itself, so no document is kept by hand:

| Document | Path | Standard |
|---|---|---|
| API catalog | `/.well-known/api-catalog` | RFC 9727 (RFC 9264 linkset) |
| OpenAPI of the MCP endpoint | `/openapi.json` | OpenAPI 3.1, the JSON-RPC envelope |
| `Link` header of the home page | `/` | RFC 8288: `api-catalog`, `service-desc`, `service-doc`, `describedby` |
| OAuth discovery additions | in the issuer's metadata | RFC 8414 / RFC 9728: `jwks_uri`, `service_documentation`, `agent_auth`, `resource_documentation` |
| JWKS | `/.well-known/jwks.json` | RFC 7517, an empty set for opaque tokens |
| auth.md | `/auth.md` | WorkOS auth.md, built from the issuer's metadata |
| MCP server card | `/.well-known/mcp/server-card.json` | SEP-2127 and SEP-1649 in one card |
| A2A agent card | `/.well-known/agent-card.json` | A2A 1.0, one interface with the `MCP` binding |
| Agent Skills | `/.well-known/agent-skills/index.json`, `…/<name>/SKILL.md` | Agent Skills Discovery v0.2.0, SHA-256 digests |
| AI catalog | `/.well-known/ai-catalog.json` | ARD 1.0, with 2 to 5 representative queries per entry |
| Web Bot Auth | `/.well-known/http-message-signatures-directory` and signed `fetch` | RFC 9421, Ed25519 |
| DNS-AID | `_index._agents.<domain>`, `_mcp._agents.<domain>` | SVCB (RFC 9460), checked by the CLI |
| WebMCP | inline script or component | `document.modelContext.registerTool` |

Cards, skills and the AI catalog read the server's own `initialize` and `tools/list` on every request, through the
transport a client uses, with an anonymous server: a tool added to the server appears everywhere without an edit,
and no account data can reach a public document. Guards (`/testing`), a `deploy.json` verify manifest and the
`agent-ready check` CLI keep the documents true after a deploy.

## 2. Installation

```bash
npm install @softure-ai/agent-ready
```

Peer dependency: `@modelcontextprotocol/server` (the app's MCP server is built with it). Entries:

| Entry | Loads in | What |
|---|---|---|
| `@softure-ai/agent-ready` | anywhere, `next.config.ts` included | `agentReady()`, origins, every document builder, `nextHeaders`, `buildVerifyManifest` |
| `/next` | route handlers | the `serve*` handlers |
| `/server` | Node | Web Bot Auth signing and the directory, MCP introspection |
| `/webmcp` | the browser | WebMCP runtime and the boot script; no imports at all |
| `/testing` | the app's tests | guards |

## 3. Configuration

```ts
// softure.config.ts
import { agentReady } from "@softure-ai/agent-ready";
import { getAuthorizationServerMetadata, resolveMcpOrigins } from "@softure-ai/mcp-access/server";

const config = defineSoftureConfig({
  appOrigin: process.env.APP_ORIGIN,
  modules: [
    // ...
    agentReady({
      apexOrigin: "https://example.com",
      name: "com.example/app",
      title: "Example",
      description: "Example keeps a person's notes; an assistant can read and add them.",
      provider: { organization: "Example Ltd" },
      mcp: { server: async () => (await import("./mcp/server")).createAnonymousServer() },
      oauth: {
        authorizationServerMetadata: (request) => getAuthorizationServerMetadata(config, resolveMcpOrigins(config, request)),
        manualTokenPath: "/mcp",
      },
      skills: [{ name: "notes", description: "Work with a person's notes.", body: (origins) => `\n# Notes\n\nSee ${origins.apexOrigin}/notes.\n` }],
      markdown: true,
    }),
  ],
});
```

| Option | Default | What |
|---|---|---|
| `appOrigin` | the config's `appOrigin` | host of the MCP endpoint and every OAuth URL |
| `apexOrigin` | the app origin | host of documentation, cards and catalogs |
| `resolveAppOrigin` | none | the app origin of one request (e.g. one image under several origins); configure it as in mcp-access |
| `name` | required | server card name, reverse-DNS namespace and name |
| `title`, `description`, `provider.organization` | required | what agents show |
| `mcp.path` | `/api/mcp` | the endpoint's path |
| `mcp.server` | required | builds the MCP server with an **anonymous** context: no account, no data |
| `mcp.protocolVersions` | the SDK's | versions the server card announces |
| `scopes` | `mcp:read`, `mcp:write` | the scopes the endpoint checks |
| `oauth.authorizationServerMetadata` | none | the issuer's RFC 8414 metadata for a request; without `oauth`, auth.md and the JWKS answer 404 |
| `oauth.manualTokenPath`, `oauth.lifetimes` | none | a manual token page and the lifetimes auth.md states |
| `serviceDoc` | `{ path: "/" }` | the page for people on the apex |
| `openapi.version` | `1.0.0` | bump it when the endpoint's contract changes |
| `apiCatalog.statusPath` | none | a public health path listed as `status` |
| `skills` | `[]` | the app's own skills |
| `mcpSkill` | `{}` | the generated connection skill (`<name>-mcp`); `false` drops it |
| `catalog.queries` | built from the title | 2 to 5 queries per AI catalog entry: `mcp`, `a2a`, `api-catalog` or a skill name |
| `a2a` | `{ enabled: true }` | the A2A card; `skillTags(tool)` adds tags |
| `webBotAuth` | `WEB_BOT_AUTH_PRIVATE_KEY`, `WEB_BOT_AUTH_RETIRED_PUBLIC_KEYS` | names of the key variables |
| `dnsAid` | `_index` → apex, `_mcp` → app | records under `_agents.<domain>` |
| `markdown` | `false` | `/` answers `Accept: text/markdown` (seo); adds `describedby` |

**Origins.** MCP and OAuth URLs are on the app host, documents on the apex, a root document's own identity on the host
it was asked on. Origins come from `Host` and `X-Forwarded-Proto`, never from `request.url` (a standalone server
reports `http://0.0.0.0:3000` there).

**OAuth with `@softure-ai/mcp-access`.** mcp-access serves the authorization server and protected resource documents;
agent-ready adds its keys through mcp-access's extensions and builds auth.md from the same metadata, so both name the
same endpoints:

```ts
mcpAccess({
  serverName: "example",
  resourceOrigins: ["https://example.com"], // the apex's root metadata names the apex as resource
  oauth: {
    enabled: true,
    metadata: {
      authorizationServer: createAgentAuthExtension({ apexOrigin: "https://example.com" }),
      protectedResource: () => buildResourceDocumentation("https://example.com"),
    },
  },
}),
```

mcp-access takes its issuer from the config's `appOrigin` (or its `resolveAppOrigin`): leave agent-ready's `appOrigin`
unset, or set it to the same value, and give both modules the same `resolveAppOrigin`. The provider is called with a
request addressed to the resolved app origin, so mcp-access computes the same issuer; an issuer on another origin is a
setup bug, and the OAuth documents answer 500 with a log line naming both origins instead of sending agents to a
`resource` the issuer refuses.

auth.md lists every endpoint from the issuer's metadata; its prose (registration rules, rotating refresh tokens,
error codes) describes an mcp-access issuer.

## 4. Mounting

One line per file:

```ts
// app/.well-known/api-catalog/route.ts
export { serveApiCatalog as GET } from "@softure-ai/agent-ready/next";
// app/openapi.json/route.ts
export { serveOpenApi as GET } from "@softure-ai/agent-ready/next";
// app/auth.md/route.ts
export { serveAuthMd as GET } from "@softure-ai/agent-ready/next";
// app/.well-known/jwks.json/route.ts
export { serveJwks as GET } from "@softure-ai/agent-ready/next";
// app/.well-known/mcp/server-card.json/route.ts
export { serveMcpServerCard as GET } from "@softure-ai/agent-ready/next";
// app/.well-known/agent-card.json/route.ts
export { serveA2aAgentCard as GET } from "@softure-ai/agent-ready/next";
// app/.well-known/agent-skills/index.json/route.ts
export { serveAgentSkillsIndex as GET } from "@softure-ai/agent-ready/next";
// app/.well-known/agent-skills/[name]/SKILL.md/route.ts
export { serveAgentSkill as GET } from "@softure-ai/agent-ready/next";
// app/.well-known/ai-catalog.json/route.ts
export { serveAiCatalog as GET } from "@softure-ai/agent-ready/next";
// app/.well-known/http-message-signatures-directory/route.ts
export { serveSignatureDirectory as GET } from "@softure-ai/agent-ready/next";
```

Add `export const dynamic = "force-dynamic";` to each file when the config reads the environment at runtime: every
handler reads the request's host, and a page rendered at build time would keep one origin.

```ts
// next.config.ts: the Link header of the home page (relative links, true on every host)
import { nextHeaders } from "@softure-ai/agent-ready";
const nextConfig = { async headers() { return [...nextHeaders({ markdown: true })]; } };

// app/layout.tsx: <link rel="ai-catalog"> in the head
import { buildAiCatalogLink } from "@softure-ai/agent-ready";
const aiCatalog = buildAiCatalogLink(); // <link rel={aiCatalog.rel} href={aiCatalog.href} type={aiCatalog.type} />

// seo's robots.other: the Agentmap line
import { buildAgentmapDirective } from "@softure-ai/agent-ready";
seo({ robots: { other: buildAgentmapDirective("https://example.com") } });
```

A proxy that lists the paths an apex serves must let these paths through.

**Web Bot Auth.** `createSignedFetch(fetch, { agentOrigin: apex })` (`/server`) signs every outgoing request when a key
is set, and sends it unsigned otherwise; pass it wherever code takes a `fetch` (seo's IndexNow `fetchImpl`). Generate
a key with `npx agent-ready web-bot-auth key > web-bot-auth.env` (it refuses to print to a terminal); rotate by moving
the old public key to `WEB_BOT_AUTH_RETIRED_PUBLIC_KEYS` for a while.

**WebMCP.** In a client component, register tools with `registerWebMcpTool(findModelContext(), tool, signal)`. A page
without a client component puts `buildWebMcpBootScript({ flag, paths, pathPatterns, tools })` into an inline
`<script>` in `<head>`; each tool's `execute` is JavaScript source `(args, h) => …` with
`h = { ok, error, fetchMarkdown, stripFrontmatter }`.

**DNS-AID.** Publish the lines of `resolveDnsAidRecords(options, origins).map(formatZoneLine)` at the DNS provider,
turn on DNSSEC, then check them:

```bash
npx agent-ready dns-aid check --domain example.com --record _index=example.com --record _mcp=app.example.com
```

**After a deploy.** `buildVerifyManifest({ host: "apex" | "app", options, origins, signatureDirectory, webMcp })`
returns `verify.routes` for `deploy.json` (`@softure-ai/deploy`): status, type and quoted markers per document, one
route per `Link` relation, `POST <mcp>` → `401` with `resource_metadata`. `npx agent-ready check https://example.com`
re-downloads every skill against its digest and verifies the directory's signature for the host.

## 5. Migrations and tables

None: the module has no database schema.

## 6. Environment variables

| Variable | Required | What |
|---|---|---|
| `WEB_BOT_AUTH_PRIVATE_KEY` | no | Ed25519 seed (base64url JWK `d`); without it requests go unsigned and the directory answers 404 |
| `WEB_BOT_AUTH_RETIRED_PUBLIC_KEYS` | no | retired public keys (`x`), comma-separated, still published |

The names follow `webBotAuth.privateKeyEnv` and `webBotAuth.retiredKeysEnv`. A malformed value is logged by its
name, never its value.

## 7. Switches

None.

## 8. Appearance

None: every output is a machine format.

## 9. Copy

The dictionaries are empty: the documents are machine formats in English. Their prose follows `title`,
`description`, `openapi.*` and `serviceDoc.title`.

## 10. Hooks

None. The token issuer's metadata comes in through `oauth.authorizationServerMetadata`; the keys go back out through
`createAgentAuthExtension` and `buildResourceDocumentation`.

## 11. GDPR

The module stores nothing and builds every document from configuration and an anonymous server, so it holds no
personal data. Guard it in the app with `expectNoAccountData`, which also fails on any UUID unless allowed.

## 12. Limitations

- The JWKS is empty: tokens are opaque. An issuer that signs JWTs publishes its own keys.
- auth.md names agentic registration without the person (identity assertions, anonymous registration) as
  unsupported, because the issuer does not run it.
- The A2A card has one interface with the `MCP` binding: the app has no A2A message endpoint.
- DNS-AID uses `alpn="h2"` and no `mandatory` keys; the records and DNSSEC are the DNS provider's to publish.
- Guards check `app/` on disk: paths served by a proxy or `rewrites` go in `servedElsewhere`.
- Markdown for agents (`Accept: text/markdown`) is seo's; this module only links to it.

## Parity with the reference implementation

The package was extracted from an app that served each document by hand. Every check the reference had is kept:
document shapes and media types per scanner check, the RFC 9421 B.1.4 key vector verified by the reference Web Bot
Auth library, the DNS-AID wire and presentation cases, auth.md endpoints against the issuer's real metadata, the
origin matrix behind a proxy, and the guards for catalog targets, skill digests and account data. What changed: the
cards are introspected instead of listing tools by hand, auth.md is built from the issuer's metadata instead of
repeated constants, and the scan by an agent-readiness checker runs in the app's adoption, since it needs a deployment.

# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/agent-ready`. When an app has run a
version in production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done").

## 0.1.3

- `nextHeaders()` returns rules assignable to `NextConfig["headers"]`: `NextHeaderRule` is now mutable like Next's
  `Header`, so `async headers() { return [...nextHeaders()]; }` typechecks in a `next.config.ts` typed as
  `NextConfig` without copying the inner `headers` array (#304).
- The MCP server factory can stay out of `softure.config.ts` (#316): `createAgentReadyRoutes({ createServer })` from
  `/next` builds every handler, the five that introspect the server around `createServer`; `mcp.server` is optional
  and still used by the plain exports. Without a factory anywhere those documents answer 500 with a log line naming
  the fix.
- One factory contract with `@softure-ai/mcp-access` (#316): the factory gets `McpDiscoveryIdentity`
  (`{ userId: <nil UUID>, canWrite, tokenId: "agent-ready-discovery" }`, the shape of mcp-access's
  `McpServerIdentity`), so the app passes the factory it gives `createMcpRoute`. `canWrite` follows mcp-access's
  `allowWrites`. A factory without arguments still fits.
- auth.md states mcp-access's token lifetimes when mcp-access issues the tokens and `oauth.lifetimes` is not set
  (#316); `readMcpAccessSettings(config)` reads them.
- WebMCP tools take a zod schema as `inputSchema` (#316), converted to JSON Schema (input side) by
  `registerWebMcpTool`, `buildWebMcpBootScript` and `toWebMcpInputSchema`.

## 0.1.2

- Without a `resolveAppOrigin` option, the app origin comes from core's `resolveAppOrigin` (#311): a listed origin
  from the config's `origins` block the request was sent to, else `appOrigin`. `readRequestHost` and
  `readRequestOrigin` are core's (`readRequestOrigin` answers `null` for a host that is no host). Documents vary on
  `x-forwarded-host` too. Needs `@softure-ai/core` 0.1.8.

## 0.1.1

- README: the installation section lists the `agent-ready` CLI commands (`web-bot-auth key`, `dns-aid check`,
  `check <url>`) next to the entries, with a pointer to where each one is described. No code change.

## 0.1.0

- First release: `agentReady()` with the API catalog (RFC 9727), OpenAPI of the MCP endpoint, the home page `Link`
  header (`nextHeaders`), OAuth discovery additions for the issuer (`createAgentAuthExtension`,
  `buildResourceDocumentation`, an empty JWKS), auth.md from the issuer's metadata, the MCP server card and the A2A
  agent card introspected from the app's server, Agent Skills with SHA-256 digests and a generated connection skill,
  the AI catalog, Web Bot Auth (signed `fetch`, signed key directory), DNS-AID records and checks, and the WebMCP
  runtime with an inline boot script.
- `buildAiCatalogLink()` for a `<link rel="ai-catalog">` in the page head.
- Guards in `/testing`, `buildVerifyManifest` for `deploy.json`, and the `agent-ready` CLI (`web-bot-auth key`,
  `dns-aid check`, `check <url>`).

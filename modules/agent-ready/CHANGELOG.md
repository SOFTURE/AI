# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/agent-ready`. When an app has run a
version in production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done").

## Unreleased

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

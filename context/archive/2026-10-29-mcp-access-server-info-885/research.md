---
change_id: mcp-access-server-info-885
status: done
---

# Research: get_server_info tool (issue #885)

## Findings

- `@softure-ai/ops/server` (#878, unreleased): `readBuildInfo(options?)` → `BuildInfo { release, commit, builtAt,
  startedAt }`, every value but `startedAt` nullable; `createBuildInfoResponse` adds `changelog` from an optional
  provider, and a failing provider answers `changelog: null` and logs the error class (`errorLogLabel`).
- `createMcpServerFactory` (`modules/mcp-access/src/server/server-factory.ts`) knows the served version before it
  registers the tools: measured per access level, or the fixed `version`. The SDK's `McpServer` has no public getter
  for its `serverInfo`, so a tool cannot read the version from its server: the factory has to hand it in.
- The measurement registers the same tools on a recording server, so a tool the factory adds must be registered there
  too, or the version would not describe the served list. Its handler is never called there, so the version it
  reports is only needed on the served server.
- `@softure-ai/ops` is an optional peer of mcp-access. Only `/scripts` imports it (`@softure-ai/ops/scripts`), and
  only apps that use those scripts load that entry. `/server` is loaded by every app, so a static or dynamic import
  of ops there would break the bundle of an app without ops.
- Tool texts for the assistant live in the module dictionary (`en.toolInput` for strict input), so the tool's
  description goes into `en.serverInfoTool`.
- `toolResult(value)` (`src/server/tools.ts`) answers a JSON value as text content.

## Options

1. The tool reads `@softure-ai/ops/server` itself: breaks apps without ops (above). Rejected.
2. The app passes the build info reader (`buildInfo: readBuildInfo`) and an optional changelog provider; the factory
   supplies name and version. No ops import in mcp-access; the shape is typed structurally. Chosen.

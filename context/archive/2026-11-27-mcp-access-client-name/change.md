---
change_id: mcp-access-client-name
title: "mcp-access: McpServerIdentity names the calling client (issue #1524)"
status: archived
roadmap_item: null
issue: 1524
branch: claude/project-thread-8s5noz
created: 2026-11-27
updated: 2026-11-27
archived_at: 2026-11-27
---

## Intent
An adopting app's MCP server knows which client is calling (an OAuth client's registered name or a hand-issued
token's name) and how it authenticated, straight from the identity `createMcpRoute` hands its factory, without reading
the package's tables. Issue #1524 (`enhancement`, `pkg: mcp-access`).

## Context
`McpServerIdentity` carries `userId`, `canWrite` and `tokenId`. An app that records "sent over MCP by <client>" calls
`findTokenClientName` (one query per request) or reads `oauthGrants`, `oauthClients` and `accessTokens` itself.
mcp-access 0.7.9.

## Scope
- `McpServerIdentity` gains `via` (how the request authenticated) and `clientName` (the OAuth client's name, at most 60
  characters, or the hand-issued token's name), read with the bearer, no extra query.
- The endpoint and the stdio entry fill them; tests (red first), README, CHANGELOG `Unreleased`.
- Out of scope: agent-ready's discovery identity; the adopting app.

## Decisions (auto)
- Recorded in `plan.md`.

## Notes
- frame skipped: an enhancement with the exact fields named in the issue.

## Done
`McpServerIdentity` carries `via` (`oauth`, `token` or `stdio`) and `clientName` (the OAuth client's registered name,
at most 60 characters, or the hand-issued token's name), read with the bearer, no extra query; optional in the type so
identities built elsewhere still fit. Tests (red first), README, CHANGELOG `Unreleased`. Ships in mcp-access 0.7.10; an
adopting app drops its own lookup of the package's tables.

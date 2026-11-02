---
change_id: mcp-access-api-tokens-961
title: "mcp-access: personal access tokens for plain HTTP routes, with app scopes, expiry and a rate limit (issue #961)"
status: in_progress
roadmap_item: null
issue: 961
branch: claude/project-thread-ddug1r
created: 2026-11-02
updated: 2026-11-02
---

## Intent
#961 (`enhancement`, `pkg: mcp-access`): a user who calls an app from a phone Shortcut, Make, Zapier or a script needs
a personal token for a regular HTTP route. `mcp-access` already stores hashed, expiring, revocable tokens, but only for
MCP (`sftmcp_`, `mcp:read`/`mcp:write`, the MCP endpoint). The app needs a second token kind with its own prefix and
app-declared scopes, a `requireApiToken(request, { scopes })` check for route handlers with a per-token rate limit and
the write switch, both kinds on the token page, and privacy and prune as today.

## Context
`modules/mcp-access`: `src/server/tokens.ts`, `src/schema.ts`, `migrations/`, `src/options.ts`, `src/contract.ts`,
`src/next/{issue-token,token-manager-props,pages}.ts(x)`, `src/ui/token-manager.tsx`, `src/messages/en.ts`,
`src/server/privacy.ts`, `src/index.ts`, `package.json` exports, README, CHANGELOG. `@softure-ai/security` rate limits.

## Constraints
- MCP tokens keep `sftmcp_`, `mcp:read`/`mcp:write` and every current behaviour; an MCP token never passes the API
  check and an API token never opens the MCP endpoint.
- The token layer an app without an MCP server uses (`@softure-ai/mcp-access/tokens`) loads no MCP SDK.
- Forward-only migration with a rollback note.
- No change to an app repository; no release in this change (the coordinator batches it).

## Notes
- Framing skipped: the issue names the problem, the options and the acceptance points.

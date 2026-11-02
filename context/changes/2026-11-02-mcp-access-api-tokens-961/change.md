---
change_id: mcp-access-api-tokens-961
title: "mcp-access: personal access tokens for plain HTTP routes, with app scopes, expiry and a rate limit (issue #961)"
status: archived
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

## Done
- `apiTokens` option (prefix, scopes, examples); migration 0004 (`kind`, `scopes`, one check); shared insert and
  lookup by kind; `issueApiToken`, `verifyApiToken`, `requireApiToken`, `apiTokenErrorResponse`;
  `API_TOKEN_RATE_LIMIT_BUCKETS` (`api` per address, `api-token` per token); entry `@softure-ai/mcp-access/tokens`
  without the MCP SDK (tested by walking its import graph).
- Token page: the app's scopes, the form "New token for other apps", one-time reveal with the app's examples
  (`api-ok`), the kind on each row; gate input `kind` and `scopes`; privacy export `kind` and `scopes`.
- Tests: `tests/api-tokens-961.test.ts`, `tests/api-tokens-961-next.test.ts`, `token-manager.test.tsx`; README
  "Tokens for HTTP routes", §5, §11, §12; CHANGELOG `Unreleased`.
- Release: next batch release (`mcp-access` minor: new option, migration, entry point).

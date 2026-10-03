---
change_id: mcp-access
title: "MCP access module: hashed, scoped, expiring tokens, a Bearer endpoint around the app's MCP server factory, and a token page"
status: implementing
roadmap_item: EN-6
branch: claude/en-6-mcp-access-y3v1d0
created: 2026-10-03
updated: 2026-10-03
archived_at: null
---

## Intent

An app that lists `mcpAccess({ serverName, tools })` in `softure.config.ts` lets its users connect
an AI assistant (Claude Code, Claude Desktop, Cursor) to their own data over MCP. A signed-in user
issues a named access token on a ready page, sees the plaintext once together with setup
instructions generated from the configuration (server name, endpoint URL), and revokes tokens from
the same page. `POST /api/mcp` counts the request against a rate limit, verifies the Bearer token
(only its sha256 is stored; unknown, revoked and expired tokens all get the same 401), and hands
`{ userId, canWrite }` to the app's own MCP server factory. A token can write only when the app sets
`allowWrites` and the token was issued with write access.

## Context

Taken from the roadmap entry, kept as [`backlog-input.md`](backlog-input.md). Roadmap:
[`roadmap.md`](../../foundation/roadmap.md) (roadmap `engagement`), item **EN-6**. Outcome, unknowns,
risk and baseline are quoted there. Source: FIRE_TRACKER `src/db/access-tokens.ts`,
`src/lib/{mcp-auth,access-token-status,mcp-client-config}.ts`, `src/app/api/mcp/route.ts`,
`src/app/actions/{manage-tokens,tokens,tokens-contract}.ts` (read-only).

## Constraints

- Exclusively owns: `modules/mcp-access/` including its migrations, `examples/next-app/e2e/mcp-access.spec.ts`,
  the example's MCP page, route and demo server.
- Shared hot file `examples/next-app/softure.config.ts`: append only this module's entry.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` dictionaries.
- No release, tag or publish by the agent; the owner tags releases. FIRE_TRACKER is read-only.

## Notes

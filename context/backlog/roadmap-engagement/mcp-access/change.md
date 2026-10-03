---
change_id: mcp-access
title: "MCP access tokens and Bearer endpoint"
status: backlog
roadmap_item: EN-6
branch: null
created: 2026-10-02
updated: 2026-10-02
archived_at: null
---

## Intent

`mcp.access_tokens` (sha256 only, name, read/write scope, expiry, last use, per-account limit); token issue/revoke actions and UI that show the plaintext once; `POST /api/mcp` (rate limit, Bearer verification, `mcp:read` / `mcp:write` scopes) wrapping an app-provided `createServer({ userId, canWrite })`; writes need both an `allowWrites` config flag and a write token; client configuration instructions generated from config (server name, URL).

## Context

From [`roadmap.md`](../../../foundation/roadmap.md), item **EN-6** (roadmap `engagement`, main since 2026-10-03):

> ### EN-6: MCP access tokens and Bearer endpoint
> - **Change ID:** `mcp-access`
> - **Status:** ready
> - **Outcome:** `mcp.access_tokens` (sha256 only, name, read/write scope, expiry, last use, per-account limit); token issue/revoke actions and UI that show the plaintext once; `POST /api/mcp` (rate limit, Bearer verification, `mcp:read` / `mcp:write` scopes) wrapping an app-provided `createServer({ userId, canWrite })`; writes need both an `allowWrites` config flag and a write token; client configuration instructions generated from config (server name, URL).
> - **Prerequisites:** roadmap-identity done (auth, security).
> - **Unknowns:** The supported `@modelcontextprotocol/server` version range; whether OAuth for MCP is in scope (likely a later item); how the app passes its tool catalog to the UI.
> - **Risk:** medium. Token handling is security-critical.
> - **Baseline:** FIRE has the full flow with a domain server. After: the example app issues a token and calls a demo MCP tool through the endpoint (e2e), unit tests cover expiry, revocation, scope and limits.
> - **PRD refs:** FR-19, NFR-5.

Reference material: [`docs/02-module-standard.md`](../../../../docs/02-module-standard.md) (the standard),
[`docs/01-module-assessment.md`](../../../../docs/01-module-assessment.md) (source map in FIRE_TRACKER).

## Constraints

- Exclusively owns: `modules/mcp-access/` including its migrations, `examples/next-app/e2e/mcp-access.spec.ts`.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.

## Notes

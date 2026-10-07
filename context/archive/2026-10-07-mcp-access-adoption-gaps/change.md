---
change_id: mcp-access-adoption-gaps
title: "mcp-access: legacy token shape, OAuth 2.1 grants, per-path lifetimes, adopting an existing table (issue #213)"
status: archived
roadmap_item: null
issue: 213
branch: claude/project-thread-5l5utj
created: 2026-10-07
updated: 2026-10-07
archived_at: 2026-10-07
---

## Intent

Close every point of [issue #213](https://github.com/SOFTURE/AI/issues/213), so an app that already runs remote MCP
with per-account tokens and OAuth-connected assistants can move onto `@softure-ai/mcp-access` without disconnecting
anyone:

1. tokens the app issued before (64 hex characters, no prefix) keep working through an opt-in legacy shape, while new
   tokens keep the `sftmcp_` prefix;
2. the module is an OAuth 2.1 authorization server for its MCP endpoint: `401` with `resource_metadata`, protected
   resource and authorization server metadata, dynamic client registration, authorize with PKCE and a consent page,
   a token endpoint with rotated refresh tokens and replay detection, and a "connected apps" list where a grant is
   revoked together with its access tokens;
3. hand-issued tokens, OAuth access tokens, refresh tokens and authorization codes each have their own lifetime;
4. an app's existing `access_tokens` (with `grant_id`) and OAuth tables can be adopted into `mcp` with a documented
   migration and a baseline, proven by a test;
5. the README says how `allowWrites` is meant to be fed from the environment.

A reviewer checks the mcp-access tests (tokens, endpoint, oauth, adoption, next routes, module, privacy), migration
`0002`, the README and the CHANGELOG.

## Context

Issue #213, filed while an adopting app planned its switch. Work is tracked in GitHub Issues, not in a roadmap: no
roadmap item; the PR closes the issue. The app's OAuth layer (clients, codes, grants with
`previous_refresh_token_hash`, scopes `mcp:read`/`mcp:write`) is lifted and generalised the way the token code was.

## Constraints

- Scope: `modules/mcp-access` only (plus the example app if it mounts the module). No other thread changes it now.
- Existing 0.1.6 behaviour stays the default: OAuth is opt-in (`oauth.enabled`), the legacy shape is opt-in.
- Secrets (tokens, codes, refresh tokens, client secrets) are stored only as sha256 and never logged.
- Migrations move forward only and say how to roll back.
- English-only code and docs; copy only in `messages/{en,pl}.ts`.

## Process notes

- Research: kept inside plan.md's "Today" section instead of a separate file. The module is 1.7k lines and was read
  in full (`tokens.ts`, `endpoint.ts`, `schema.ts`, migration `0001`, the Next adapter, the token manager); the
  adopting app's OAuth code (data layer, validation, metadata, routes, consent page) was read in full as the source
  to lift; the db adoption comparison (`foundation/db/src/migrations/introspect.ts`) was read to know what an
  adoption must match (columns with defaults, constraints and indexes by name).
- Framing: skipped. Every point is an observed gap with the remedy the adopter named; the only open choice
  (OAuth opt-in vs on by default) is decided in the plan.

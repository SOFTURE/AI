---
change_id: mcp-access-challenge-scopes-553
status: open
---

# Plan: challenge and default scopes follow allowWrites (issue #553)

Input: change.md, research.md. Complexity: small (two functions, tests, docs).

## Phase 1: challenge scope (TDD)

Files: `modules/mcp-access/src/server/endpoint.ts`, `modules/mcp-access/tests/endpoint.test.ts`.

1. Tests first: with OAuth on and `allowWrites` on, the 401's `WWW-Authenticate` carries `scope="mcp:read mcp:write"`;
   with `allowWrites` off, `scope="mcp:read"`; the Bearer-only (OAuth off) challenge follows the same rule.
2. `authenticate()` builds `requiredScopes` from `getMcpAccessOptions(ctx.config).allowWrites`.

## Phase 2: default scope on the authorization request (TDD)

Files: `modules/mcp-access/src/server/oauth-http.ts`, `modules/mcp-access/tests/oauth-http.test.ts`.

1. Tests first: no `scope` (and a blank one) is `isWriteRequested: true` while `allowWrites` is on and `false`
   while off; an explicit `mcp:read` stays read-only.
2. `validateAuthorizationRequest` reads a missing or blank scope as the default scope.

## Phase 3: docs

`modules/mcp-access/README.md` (challenge and default scope), `modules/mcp-access/CHANGELOG.md` `## Unreleased` with
the migration for an adopting app (drop the 401 rewrite workaround, reconnect once).

## Progress

- [x] Phase 1: challenge scope (tests for allowWrites on were red before the change, on and off, OAuth on and off)
- [x] Phase 2: default scope (no and blank scope with allowWrites on were red before the change)
- [ ] Phase 3: docs

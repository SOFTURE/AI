---
change_id: core-request-origin-rule
title: "core: one request-origin rule for auth, agent-ready, mcp-access and analytics (issue #311)"
status: archived
roadmap_item: null
issue: 311
branch: claude/project-thread-c2w4yp
created: 2026-10-09
updated: 2026-10-09
archived_at: 2026-10-09
---

## Intent

Close [issue #311](https://github.com/SOFTURE/AI/issues/311): four modules read the public origin of a request
(`X-Forwarded-Proto`, `Host`, `X-Forwarded-Host`, the `appOrigin` fallback, extra trusted hosts) with their own code
and their own edge cases, and an adopting app adds more copies and passes the same `resolveAppOrigin` to two modules.

After the change `@softure-ai/core` owns the rule (`readRequestHost`, `readRequestOrigin`, `resolveAppOrigin`,
`getTrustedOrigins`), the app config takes one `origins` block (`trustedOrigins`, `trustRequestHost`) next to
`appOrigin`, and auth, agent-ready, mcp-access and analytics use both. `@softure-ai/mcp-access/next` exports
`getRequestOrigins`.

A reviewer checks `foundation/core/tests/origins.test.ts` (the rule and its edge cases), the module tests that pin
each module's behaviour under the config block, and the core README section "Request origins".

## Context

Issue #311, filed by an adopting app. Work is tracked in GitHub Issues: no roadmap item; the PR closes the issue.
`@softure-ai/core` 0.1.7 is the last released version; issue #312 (core calendar and format helpers) is in flight in
parallel and shares the next core version.

## Constraints

- Existing configs keep working unchanged: without an `origins` block every module answers as before (the block
  defaults to no extra origins and `trustRequestHost: false`).
- The per-module options stay accepted (`createAuthGuard({ trustedOrigins })`, `resolveAppOrigin` in agent-ready and
  mcp-access, `analytics({ origins })`); the README of each points to the config block instead.
- Security properties already pinned by tests stay: auth's redirect goes only to a listed origin; the mcp-access
  consent decision never trusts `X-Forwarded-Host` (#294); analytics selects only configured origins.
- English-only code and docs; no copy changes.

## Process notes

- Research: kept in plan.md's "Today" section (the four copies and their differences, read from the code); no
  separate research.md since every unknown was answered by reading the named files.
- Framing: skipped. The issue names the copies and the proposal; the open choices are settled in plan.md.

## Decisions (auto)

- `X-Forwarded-Host` is read only where a trust list gates the result (see plan.md, decision 2).
- `trustRequestHost: true` trusts `Host` (and `X-Forwarded-Proto`), not `X-Forwarded-Host`: it is the old
  `resolveAppOrigin: readRequestOrigin` setup moved into the config.
- Versions: core 0.1.8, auth 0.1.11, agent-ready 0.1.2, mcp-access 0.1.12, analytics 0.1.10 (patch bumps, as every
  0.1.x change so far; nothing is removed).

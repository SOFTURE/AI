---
change_id: connections-token-state-outside-tx-935
title: "connections: a token refresh survives the rollback of the caller's transaction (issue #935)"
status: in_progress
roadmap_item: null
issue: 935
branch: claude/project-thread-p6vpni
created: 2026-11-02
updated: 2026-11-02
---

## Intent

Close [issue #935](https://github.com/SOFTURE/AI/issues/935): `getAccessToken`, `replaceRejectedToken` and the
`requestWithConnection` / `downloadWithConnection` path write the refreshed tokens, the refresh lease, the
`reconnect_required` state and run `onReconnectRequired` through `ctx.db`. When `ctx.db` is a transaction that rolls
back (a `processSyncItem` item that fails), the provider-side effect stays but the stored state is lost: a rotated
refresh token is replayed later (the provider revokes the grant), and an `invalid_grant` never reaches
`reconnect_required` or the owner's hook. Take the issue's first proposal: the token state is written outside whatever
transaction `ctx.db` is, so every caller is fixed without a change in the apps.

## Context

Labels: `status: in progress` (the issue carries no type label). No release in this change: the coordinator releases
in the next combined release. Issue #936 touches `connections` in parallel (the error detail of `refresh_failed`);
fresh master is merged in before the merge.

## Constraints

- No change for a caller whose `ctx.db` is not a transaction (the module's own adapters, a plain pool).
- Nothing in the app changes; the public signatures stay the same.
- The acceptance tests of the issue run against a real Postgres (PGlite has one connection).
- A database that has a single connection (PGlite) keeps today's behaviour: writing outside an open transaction there
  would wait for that transaction forever.

## Notes

- Framing: skipped. The issue names the problem, three solutions and the preferred one.

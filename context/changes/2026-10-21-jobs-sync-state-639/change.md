---
change_id: jobs-sync-state-639
title: "jobs: sync state for polling integrations, a cursor per source and a processed-item ledger (issue #639)"
status: in_progress
roadmap_item: null
issue: 639
branch: claude/project-thread-29wf7r
created: 2026-10-21
updated: 2026-10-21
---

## Intent

Close [issue #639](https://github.com/SOFTURE/AI/issues/639). Jobs that poll third-party sources need a cursor per
source, advanced only after its batch was handled, and a ledger of processed items so a second run never acts twice,
a failed item is retried a bounded number of times and the owner can see what passed, what failed and why. Today
every app builds its own tables for it.

## Context

Labels: `enhancement`, `pkg: jobs`. Additive to `@softure-ai/jobs` 0.1.3 with one forward migration; releases are
batched by the coordinator: no version bump, the CHANGELOG gets `## Unreleased`.

## Acceptance

- Migration `0004_create_sync_state.sql` creates `jobs.sync_cursors` and `jobs.sync_items` with database constraints
  for every invariant (status values, finished state, attempt bounds, text lengths).
- `getSyncCursor` / `advanceSyncCursor` read and compare-and-set a source's cursor; a stale `from` is refused with
  `jobs.sync_cursor_moved`, so two workers cannot move it backwards.
- `processSyncItem(ctx, { source, itemId, maxAttempts }, run)` runs `run` with a transaction that also records the
  outcome; returns `skipped` without running for an item already done, skipped or failed; a failure rolls back the
  caller's writes but counts the attempt; after `maxAttempts` the item is `failed`.
- `listSyncItems(ctx, { source?, status?, since?, limit? })` for an overview; `pruneSyncItems(ctx)` deletes items not
  seen within `retention.syncItemsDays`, and the worker runs it with its hourly prune.
- `@softure-ai/jobs/testing` exports `listSyncState(db)` for assertions.
- README and CHANGELOG `## Unreleased` describe the tables, the API and the app's migration.

## Notes

- Framing: skipped. The issue states the gap and the shape of the fix.

## Decisions (auto)

- Names carry `Sync` (`getSyncCursor`, `advanceSyncCursor`, `processSyncItem`, `listSyncItems`, `pruneSyncItems`)
  instead of the issue's `getCursor` / `processOnce`: inside a jobs package a bare "cursor" or "once" is ambiguous.
- `advanceSyncCursor` takes an options object (`{ source, from, to }`, AGENTS.md: more than three inputs) and returns
  a result (`jobs.sync_cursor_moved`), not a boolean: losing the race is an expected failure.
- The ledger lives in `@softure-ai/jobs` (schema `jobs`), not a companion package: it shares the context, the
  migrations and the worker's prune.
- Pruning runs inside the worker's existing hourly prune, by `last_seen_at`, so an item the source still returns is
  never forgotten (forgetting it would make the next run act on it again). No extra schedule to configure.
- A throw from `run` is recorded as a failed attempt (`jobs.sync_item_threw`) and then rethrown: it is a bug, but a
  poison item must still end `failed` after `maxAttempts` instead of looping forever.

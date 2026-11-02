---
change_id: jobs-wait-sync-item-939
title: "jobs: a sync item failure that waits for an operator keeps the item's attempts (issue #939)"
status: open
roadmap_item: null
issue: 939
branch: claude/project-thread-bfdwte
created: 2026-11-02
updated: 2026-11-02
---

## Intent

Close [issue #939](https://github.com/SOFTURE/AI/issues/939): `processSyncItem` counts every failure as an attempt,
so a failure that only an operator can clear (a connection that needs a reconnect) burns all attempts within the
queue's backoff and leaves healthy items `failed`. A callback can return a failure that waits: the savepoint rolls
back, the item stays `pending` with its attempts unchanged and its `error_code` set, and `maxAttempts` is never reached
through such failures. An app can list the items waiting on a given code.

## Context

- Labels: `enhancement`, `pkg: jobs`, `adoption`. Found while adopting jobs in an adopting app, which now gives the
  attempt back with its own `UPDATE` of `jobs.sync_items`.
- Open PRs in jobs: #941 (#933) and #943 (#934); they touch the worker and run logging, not the sync ledger. Only the
  CHANGELOG may conflict.

## Constraints

- No version bump: the coordinator releases. CHANGELOG under `Unreleased`.
- No migration: the existing columns hold everything.

## Notes

- Framing: skipped. The issue names the behaviour, the shape and the acceptance tests.

## Decisions (auto)

- Shape: `retry: "wait"` on `SyncItemFailure` plus a `waitSyncItem(code)` helper next to `failSyncItem`, as the issue
  proposes first; `retry` keeps its boolean meaning.
- Outcome: a new `{ kind: "waiting", error, item }` rather than `retrying`, so an app can tell "try again on the next
  run" from "nothing to do until the cause is fixed" (a discriminated union, per the conventions).
- Listing: `listSyncItems` takes an `errorCode` filter; with `status: "pending"` it lists the items waiting on a code.
  No separate helper.

---
change_id: jobs-reopen-sync-item-811
title: "jobs: reopen a settled sync item so an operator can process it once more (issue #811)"
status: in_progress
roadmap_item: null
issue: 811
branch: claude/project-thread-8q0rkg
created: 2026-10-26
updated: 2026-10-26
---

## Intent

Close [issue #811](https://github.com/SOFTURE/AI/issues/811): `retrySyncItem` reopens only a `failed` ledger item, so
an app that lets an operator reprocess a `done` or `skipped` item writes `jobSyncItemsTable` itself. Ship
`reopenSyncItem(ctx, { source, itemId })` in `@softure-ai/jobs/server`: any settled item (`done`, `skipped`,
`failed`) goes back to `pending` as never tried (attempts, error code, result ref and finish time cleared); a
`pending` item is returned unchanged; it runs on `ctx.db`, so a transaction there reopens the item atomically with the
caller's enqueue.

## Context

- Labels: `enhancement`, `pkg: jobs`, `adoption`. Found while adopting jobs in an adopting app.
- `retrySyncItem` (#654) and its panel action stay as they are.

## Constraints

- No version bump: the coordinator releases. CHANGELOG under `Unreleased`.
- Merges after #785 (PR #799) and #803 (PR #808), which also change jobs, with a fresh master merged in.

## Notes

- Framing: skipped. The issue names the function, its result and its semantics.

## Decisions (auto)

- No panel button. The issue marks it optional; the panel's sync rows are reworked by #803 (PR #808) in parallel, and
  reopening a `done` item from a shared admin screen breaks "at most once" with one click. Apps put it behind their
  own explicit operator action, as the issue asks.

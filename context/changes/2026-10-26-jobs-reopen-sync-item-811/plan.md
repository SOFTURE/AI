---
change_id: jobs-reopen-sync-item-811
status: in_progress
---

# Plan: reopen a settled sync item (issue #811)

Input: change.md, research.md. Complexity: small (one function, tests, docs).

## Phase 1: `reopenSyncItem`

Files: `modules/jobs/src/server/sync-items.ts`, `modules/jobs/src/server/index.ts`, `modules/jobs/tests/steering.test.ts`,
`modules/jobs/README.md`, `modules/jobs/CHANGELOG.md`.

1. `reopenSyncItem(ctx, { source, itemId }): Promise<Ok<SyncItem> | Err<"jobs.sync_item_not_found">>`: one
   conditional `UPDATE` where status is `done`, `skipped` or `failed`, setting `pending`, attempts 0, `errorCode`,
   `resultRef`, `finishedAt` null, `updatedAt` now, returning the row. No row: read the item; `pending` returns it,
   missing (or an invalid source or id) is `jobs.sync_item_not_found`. Export it with `ReopenSyncItemInput` and
   `ReopenSyncItemResult`. The JSDoc says it deliberately breaks "at most once" for that item.
2. Tests: done (with result ref), skipped (with reason) and failed items reopen as never tried and the next
   `processSyncItem` runs the callback; a pending item is returned unchanged (attempts and error kept); missing and
   invalid inputs are `not_found`; inside a transaction with a write that rolls back, the reopen rolls back too.
3. README server table row and a line in "Sync state for polling"; CHANGELOG `Unreleased`.

## Progress

- [ ] Phase 1: `reopenSyncItem`

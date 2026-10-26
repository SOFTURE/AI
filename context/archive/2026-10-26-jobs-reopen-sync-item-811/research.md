# Research: reopen a settled sync item (issue #811)

## Findings

- `modules/jobs/src/server/sync-items.ts`: `processSyncItem` upserts and locks the item's row in its transaction and
  skips any item that is not `pending`. `retrySyncItem` is one conditional `UPDATE ... WHERE status = 'failed'`
  returning the row, then a `select` to tell `not_found` from `not_retryable`. It validates source and item id
  silently (an invalid one is `not_found`).
- Columns a settled item carries: `status`, `attempts`, `error_code`, `result_ref` (done only), `finished_at`,
  `updated_at`. `first_seen_at` and `last_seen_at` belong to the sighting, not to the outcome.
- A conditional `UPDATE` on Postgres (READ COMMITTED) waits for a row an in-flight `processSyncItem` holds, then
  re-checks its `WHERE` on the committed version: an item being handled is reopened after it settles, never mid-run.
- `ctx.db` may be a transaction (the type is the drizzle database, which a transaction satisfies), as with
  `advanceSyncCursor`, so the caller's enqueue and the reopen commit together.

## Options

1. Widen `retrySyncItem` to `done`/`skipped`: changes a released contract and the panel's Retry semantics.
2. New `reopenSyncItem` next to it, as the issue proposes. Same shape, `pending` is a no-op success.

## Recommendation

Option 2.

# Research: a sync item failure that waits (issue #939)

## Findings

- `modules/jobs/src/server/sync-items.ts`: `processSyncItem` computes `attempt = row.attempts + 1`, runs the callback
  in a savepoint (a returned failure is thrown as `RunFailed` to roll it back) and `record()` writes the outcome:
  `failed` when `retry === false` or `attempt >= maxAttempts`, otherwise `retrying` with `attempts: attempt`.
- The guard `row.attempts >= maxAttempts` before the run fails an item without running it. A failure that does not
  write `attempts` never moves the item towards it.
- `SyncItemFailure = Err<ErrorCode> & { retry?: boolean }` in `src/sync.ts`; `failSyncItem` sets `retry: false`.
- Consumers of `SyncItemOutcome.kind`: only tests in the repository; no other package calls `processSyncItem`
  (`foundation/db` only names it in a comment). The admin panel reads the ledger rows, where a waiting item is a
  `pending` row with an error code, like a retrying one.
- `listSyncItems` filters by source, status and `since`; there is no index need for a small `error_code` filter
  beyond the existing scan bounded by `limit`.

## Options

1. `countsAttempt: false` on the failure: a second flag that combines oddly with `retry: false`.
2. `retry: "wait"`: one field says what happens next (`true`/omitted, `false`, `"wait"`). Chosen.

## Recommendation

Option 2, with `waitSyncItem(code)`, a `waiting` outcome and an `errorCode` filter on `listSyncItems`.

---
change_id: jobs-sync-state-639
verdict: approved
---

# Implementation review: jobs sync state (issue #639)

## Against the acceptance

- Migration `0004_create_sync_state.sql` with a rollback header; constraints for status, final state, error code on
  failed, attempts, result reference on done only, lengths and sighting order; tests insert every rejected shape.
- Cursor: `advanceSyncCursor` is a conditional insert (from null) or conditional update (from a value); a stale `from`
  returns `jobs.sync_cursor_moved`; a move inside a rolled-back caller transaction disappears (tested).
- `processSyncItem`: upsert-and-touch locks the row; final items return `skipped` untouched (callback not run, tested);
  failure rolls back the callback's writes through a savepoint and counts the attempt; `maxAttempts`, `failSyncItem`,
  a lowered `maxAttempts`, a throw (recorded then rethrown), a failing query inside the callback, an invalid
  `resultRef` and a non-result return are all covered.
- `listSyncItems` filters and order tested; `pruneSyncItems` goes by `last_seen_at`, boundary tested to the
  millisecond, and the worker prunes the ledger on its first round (tested).
- Docs: README section with an example, tables, copy keys, GDPR note; CHANGELOG `## Unreleased` with the migration.

## Gates

`npm run typecheck`, `npm run lint` (ESLint + language gate) green; `vitest run modules/jobs` green (all files).

## Findings

None blocking. Concurrency of two real Postgres sessions on one item is not exercised (PGlite has one connection),
as for job claims; the README already states it.

Verdict: approved.

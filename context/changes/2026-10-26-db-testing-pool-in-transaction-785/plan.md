---
change_id: db-testing-pool-in-transaction-785
status: open
---

# Plan: fail fast on a pool query inside a test transaction (issue #785)

Input: change.md, research.md. Complexity: small (one guard module, tests, docs).

## Phase 1: guard in `@softure-ai/db/testing`

Files: `foundation/db/src/testing/transaction-guard.ts`, `foundation/db/src/testing.ts`,
`foundation/db/tests/testing-transaction-guard.test.ts`, `foundation/db/README.md`, `foundation/db/CHANGELOG.md`.

1. `guardPoolInsideTransaction(client)`: overrides the instance's `transaction` so its callback runs in an
   `AsyncLocalStorage` scope `{ client, isOpen }` (`isOpen` cleared when the callback settles); overrides `query`,
   `exec` and `transaction` to reject with a `PoolInsideTransactionError` when called inside an open scope of the
   same client. The message names the cause (one connection, the call would wait for the transaction forever) and
   the fix (use the transaction's `db`, e.g. the one a `processSyncItem` callback gets).
2. `createTestDatabase` guards every copy it opens (reused ones included, guarded once).
3. Tests: a drizzle query on `database.db` inside `database.db.transaction` rejects fast with the message; a raw
   `client.query` and a nested `client.transaction` the same; queries through `tx` work; a pool query from unrelated
   concurrent work waits and succeeds after commit; a promise started in the callback that queries the pool after
   the transaction ended succeeds; reuse still resets.
4. README "Tests" paragraph and CHANGELOG `Unreleased`.

## Phase 2: docs in jobs and connections

Files: `modules/jobs/README.md`, `modules/jobs/CHANGELOG.md`, `modules/jobs/tests/*` (one test),
`modules/connections/README.md`, `modules/connections/CHANGELOG.md`.

1. jobs "Sync state for polling": every database access inside `run` goes through the callback's `db`; example of a
   provider call with `requestWithConnection({ ...ctx, db })`; a token refreshed in a delivery that then fails is
   rolled back with the item (the provider may then reject the old refresh token; re-read and reconnect).
2. jobs test: a `processSyncItem` callback that reads through the outer `ctx.db` ends with the guard's error
   (recorded as a failed attempt and rethrown), not a hang.
3. connections: one bullet for `requestWithConnection` inside a transaction.

## Decisions (auto)

- Both the guard and the docs (the issue accepts any; the guard prevents the silent hang everywhere).
- Guard only in the test helper; `createDatabase("pglite://")` (dev) unchanged, its hang is not reported and a dev
  server may run unrelated concurrent requests through `AsyncLocalStorage`-carrying frameworks.
- Error thrown as a rejected promise of the overridden method, so drizzle surfaces it from the awaited query.

## Progress

- [ ] Phase 1: guard in db/testing
- [ ] Phase 2: docs in jobs and connections

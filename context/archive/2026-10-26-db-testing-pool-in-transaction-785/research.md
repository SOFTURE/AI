# Research: pool query inside a transaction on the PGlite test database (issue #785)

## Findings

- `createTestDatabase` (`foundation/db/src/testing.ts`) opens a `PGlite` per call and wraps it with
  `createPgliteHandle` (drizzle `drizzle-orm/pglite`).
- drizzle's `PgliteSession.transaction` calls `client.transaction(cb)`; inside, queries go through the transaction
  object PGlite passes to `cb` (its own `query`, `sql`, `exec`), not through the instance methods. Outside, every
  drizzle query calls `client.query(...)`.
- PGlite 0.5.10: `query`, `exec` and `transaction` all run under `_runExclusiveTransaction`; the transaction holds it
  until COMMIT/ROLLBACK. `sql` calls `this.query`. So an instance call made while a transaction's callback awaits it
  is a deadlock, with no error.
- `testing/reuse.ts` resets with `client.exec` and `client.transaction(tx => tx.…)`, outside any test transaction.
- `processSyncItem` (`modules/jobs/src/server/sync-items.ts`) runs `run({ ...ctx, db: tx, attempt })` inside
  `ctx.db.transaction`; the README section "Sync state for polling" says writes go through `db` but does not say a
  read through the outer `ctx.db` deadlocks the test database.
- `requestWithConnection` (connections) reads and may refresh the credential through `ctx.db`.

## Options

1. Docs only (jobs + connections README). Cheap, but the next hang is still silent.
2. Guard in `@softure-ai/db/testing`: run each transaction callback in an `AsyncLocalStorage` scope bound to the
   client; an instance `query`, `exec` or `transaction` called from inside that scope (while the transaction is
   open) rejects with a clear error. Unrelated concurrent work has no scope, so it still waits as before.
3. A timeout on pool queries in tests: slower to fail and misfires on slow legit queries.

## Recommendation

Options 1 and 2 together: the issue's acceptance takes either; the guard turns the hang into an error in every
module's and app's tests, the docs state the rule and the rollback consequence.

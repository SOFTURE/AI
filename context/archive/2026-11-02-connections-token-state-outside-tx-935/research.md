---
change_id: connections-token-state-outside-tx-935
status: done
---

# Research: token state and the caller's transaction

## Where the state is written

- `src/server/tokens.ts`: `readAccessToken` → `resolveToken` (lease `UPDATE … RETURNING`), `refreshUnderLease`
  (stores the new sealed tokens), `recordFailure`, `waitForRefresh` (polls with `findAccount`).
- `src/server/store.ts`: `markReconnectRequired` (status change, lease release, `onReconnectRequired` hook with `ctx`),
  `releaseLease`, `findAccount`.
- `src/server/credentials.ts`: `reportCredentialRejected` → `markReconnectRequired` (used by `request.ts` on a standing
  401, and by apps directly).
- Everything goes through `ctx.db`, typed `Queryable` (a connection or an open transaction).

## How a caller ends up in a transaction

- `@softure-ai/jobs` `processSyncItem` runs the callback with `{ ...ctx, db: savepoint }`; a failed item rolls the
  savepoint back. An app builds its API client on that context, so every refresh is inside the savepoint.
- The module's Next adapter (`src/next/context.ts`) uses `getConfiguredDatabase(config.database)`: never a transaction.

## Getting a connection outside the transaction

- A drizzle transaction does not expose its pool. The app's database is reachable from the context's config:
  `getConfiguredDatabase(config.database)` (`@softure-ai/db`) answers the app's `database.handle` or the process-wide
  handle for `database.url`, the same one the adapters use.
- A transaction is recognised with drizzle's `is(value, PgTransaction)` (entity kinds, so it works across copies of
  drizzle-orm); savepoints are `PgTransaction` too.
- PGlite has one connection: a query on the instance from inside one of its transactions waits forever (the test
  database rejects it with `PoolInsideTransactionError`). Only a `postgres` handle can take the writes outside.
- `database.url` may be `pglite://…` or empty in tests (`tests/support.ts` uses `pglite://`); resolving must not open a
  database for such a config.

## Risks

- Lock wait: if the caller's transaction itself updated the account row (e.g. `saveCredential` in the same
  transaction), a write on another connection waits for that transaction, which waits for this call. All token writes
  move outside together, so the module's own token path never holds a row lock in the caller's transaction.
- Pool size: the call borrows a second connection while the caller holds one for its transaction; a pool whose every
  connection holds such a transaction would wait. Document it.
- Reads: `waitForRefresh` must read the state where it is written (outside), or a `REPEATABLE READ` caller would never
  see another worker's refresh.

## Test infrastructure

- `SOFTURE_TEST_POSTGRES_URL` (CI's postgres:16 service) and `isPostgresRequired` pattern in
  `modules/billing/tests/postgres.ts`: a database per test, `migrate(handle, { modules })`, drop on close.

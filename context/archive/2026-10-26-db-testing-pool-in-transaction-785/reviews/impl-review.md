---
change_id: db-testing-pool-in-transaction-785
verdict: approved
---

# Implementation review

Reviewed commits 920ca3b and e4b6be5 against plan.md and issue #785.

- Guard: `foundation/db/src/testing/transaction-guard.ts` overrides the copy's `query`, `exec` and `transaction`;
  each transaction callback runs in an `AsyncLocalStorage` scope bound to the client and closed when the callback
  settles. A call from an open scope of the same client rejects with `PoolInsideTransactionError`, whose message names
  the cause and the fix. Applied once per PGlite instance, so reused databases stay guarded without double wrapping.
- Without the guard the first test times out (reproduced the hang at 3 s); with it it fails at once and the
  transaction rolls back.
- No false positives: unrelated concurrent pool work waits and runs after commit; work started in the callback that
  queries after the transaction ended runs; the reuse reset (which uses only `tx`) is unaffected. The whole suite
  (9502 tests, every module's PGlite tests) passes on the guarded helper.
- drizzle wraps the driver error: the guard's error is the `cause` of the `DrizzleQueryError`. Documented in the db
  README; the jobs test asserts the cause.
- Docs: jobs README states the rule with a `requestWithConnection({ ...ctx, db })` example, the refresh rollback and
  the row wait; connections README the same for any transaction; CHANGELOGs under `Unreleased` (db, jobs,
  connections). No version bump.
- Gates: typecheck, ESLint, language gate, `npm test` green (deploy-workflows needed `openssh-client` in the
  container, unrelated).

Verdict: approved, no changes.

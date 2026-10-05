# Plan review: migrator-transaction-guard

Date: 2026-10-05 · Verdict: approved

- The marker must differ between any two transactions; a timestamp cannot promise that, a transaction
  id can. `pg_current_xact_id()` exists from Postgres 13 (the stack runs 16 and PGlite 16).
- Calling it assigns an id to the migrator's transaction, which already writes (schema, ledger), so
  nothing new is consumed.

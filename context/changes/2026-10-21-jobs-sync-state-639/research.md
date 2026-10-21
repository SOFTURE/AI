---
change_id: jobs-sync-state-639
status: done
---

# Research: sync state for polling integrations (issue #639)

## What exists

- `modules/jobs` (0.1.3): schema `jobs`, tables `jobs` and `schedules`, migrations `0001` to `0003`, drizzle view in
  `src/schema.ts`. Server API in `src/server/*` takes `JobsContext = ModuleContext<Queryable>` (`{ db, clock, config }`,
  `db` may be a transaction).
- `enqueueJob` dedups only while a job is pending or running (partial unique index), so it cannot remember that an
  item was already handled once the job finished and was pruned.
- `schedules.ts` shows the module's compare-and-set idiom: a conditional upsert (`onConflictDoUpdate ... where`).
- `pruneJobs` deletes in batches of 1000; the worker calls it once an hour (`run-job-worker.ts`, `PRUNE_INTERVAL_MS`),
  logging failures and going on.
- Options: `retention` holds `succeededDays`, `failedDays`, `cancelledDays`; a test pins the full default object.
- Error codes are a union in `contract.ts` with one `messages/en.ts` key each; the manifest `tables` list must match
  `module.json` (module test).
- Testing entry exports `runDueJobs` and `listJobs(db)`.

## Postgres facts the design relies on

- `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` locks the conflicting row and, under READ COMMITTED, a second
  session blocks until the first commits and then returns the newest row version. So "upsert and touch" both creates
  the ledger row and serialises two workers on one item, without a separate `SELECT ... FOR UPDATE`.
- Drizzle's `tx.transaction()` opens a savepoint (node-postgres and PGlite drivers alike), so the caller's writes in
  `run` can be rolled back while the attempt is still recorded in the enclosing transaction.

## Risks

- `run` holds a row lock and a transaction open while it calls an external API. That is the price of "effect and
  acknowledgement commit together"; documented, with the advice to keep each item short.
- An external effect that happened before a crash, without the commit, runs again next time: at-least-once, as for jobs.

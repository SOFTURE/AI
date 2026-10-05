---
change_id: migrator-transaction-guard
title: "The migrator notices a file that ended its transaction every time, not only when the clock moved"
status: archived
roadmap_item: null
branch: claude/project-thread-wa8tm8
created: 2026-10-05
updated: 2026-10-05
archived_at: 2026-10-05
---

## Intent

`applyFile` in `foundation/db/src/migrations/migrator.ts` detects a migration file that ended the
migrator's transaction (a `COMMIT` that slipped past `findTransactionControl`) by comparing a marker of
the current transaction before and after the file. The marker is now `pg_current_xact_id()` instead of
`now()`.

## Context

The billing@0.1.2 release run failed its test gate on `migrator.test.ts` ("does not call a file rolled
back when it ended the transaction itself"): the guard returned no problem. Measured: on PGlite two
consecutive transactions share `now()` in 95 of 300 tries (its clock ticks in milliseconds), and never
share `pg_current_xact_id()` (0 of 300); on Postgres the id also changes across `COMMIT`. So the guard
missed a committed file about a third of the time on PGlite, and could on Postgres within one
microsecond. The other 15 packages' 0.1.2 runs passed the same test by chance.

## Constraints

- Owns: `foundation/db/src/migrations/migrator.ts` (the guard), `foundation/db/tests/migrator.test.ts`.
- No version bump: the fix ships with db's next release.

## Notes

- Placement: no main roadmap in flight; found during the owner's first release (2026-10-05).
- Research and framing skipped: the cause is measured above.

# Implementation review: db-migrator

Reviewed: phases 1-4 @ 2026-10-02 (an independent read-only reviewer with live probes on PGlite and
PostgreSQL 16, plus the author's check). Verdict: approve after fixes.
Findings: 0 critical, 5 warning, 3 suggestion.

## Drift from plan

None in scope: every Progress item and every named test case exists. The secret check held: five
malformed or unreachable URLs printed no password.

## Findings

### W1 [WARNING] A lost pg connection crashed the process
**Where:** `src/migrations/session.ts`, `src/client.ts`
**Problem:** no `'error'` listener on the checked-out client or the pool; a terminated backend
raised an unhandled `'error'` event (probe: `pg_terminate_backend` in a file printed a raw stack).
**Decision:** Fix now (applied) - listeners on the session client and the pool; a Postgres test
terminates the backend mid-run and checks the ledger and the pool afterwards.

### W2 [WARNING] Transaction-control detection was line-based
**Where:** `src/migrations/files.ts`
**Problem:** `SELECT 1; COMMIT;`, `END;`, `ABORT;`, `COMMIT AND CHAIN;` passed; a top-level `END;`
committed part of a file that was then reported as rolled back.
**Decision:** Fix now (applied) - statements are checked after removing comments, strings, quoted
identifiers and dollar-quoted bodies; the runner also compares `now()` before and after the file
and reports a file that ended its transaction as such. Tests for eleven forms and for the guard.

### W3 [WARNING] Adopt missed composite and range types, collations and sequence parameters
**Where:** `src/migrations/introspect.ts`
**Decision:** Fix now (applied) - composite and range types, column collation, `pg_sequence`
parameters and unlogged tables are described; one adopt test each.

### W4 [WARNING] `--export-migrations` could delete an unrelated folder
**Where:** `src/migrations/export.ts`
**Decision:** Fix now (applied) - only `.sql` files of an earlier export are replaced; a module
folder holding anything else is refused (`db.export_target_not_empty`); tests added.

### W5 [WARNING] Phase 1 was red in CI
**Where:** commit b2e5e18, `tests/postgres-env.test.ts`
**Problem:** the CI guard for the Postgres server landed in phase 1, the CI service in phase 2, so
the phase 1 commit failed its test job (`.toMatch() expects to receive a string`).
**Decision:** Accept risk - later commits carry the service; the branch head is what merges. The
guard did what it is for.

### S1 [SUGGESTION] `--config` without a value fell back to the default config
**Decision:** Fix now (applied) - usage error, exit 2.

### S2 [SUGGESTION] `softure migrate --help` needed a config
**Decision:** Fix now (applied) - help is printed first.

### S3 [SUGGESTION] Cleanup errors could hide the original error
**Where:** `applyFile`, `withMigrationLock`, adopt's write
**Decision:** Fix now (applied) - a failed `ROLLBACK` is appended to the reason; a failed unlock
after a failed run keeps the run's error as `cause`.

## Triage summary
Fixed: W1-W4, S1-S3. Accepted: W5. Deferred: -. Dismissed: -.

## Decisions (auto)

- All fixes are local to `foundation/db/`; no plan change was needed.
- Phase 2 tests were written next to the sources rather than strictly before them; every phase's
  tests fail without its sources (imports), so items 1.1-4.1 stand.

# Implementation review: deploy-db-guard

Scope: full · Date: 2026-10-05 · Gates: typecheck, lint (ESLint + language), test (with the local Postgres 16), build

## Verdict

Ready. `softure-deploy backup`, `schema-guard` and `row-counts` are in `@softure-ai/deploy`, with the guard's
comparison exported from `@softure-ai/db` (`checkExportedMigrations`). 14 CLI tests run on a fresh Postgres database
each (skipped locally without `SOFTURE_TEST_POSTGRES_URL`, always run in CI), plus units and 11 ledger-check tests on
PGlite and Postgres. The built bin was run by hand on the local server: a `0600` dump, a guard pass listing the ledger
and a module file as pending, counts saved and compared.

| Dimension | Verdict | Notes |
| --- | --- | --- |
| Plan coverage | PASS | phases 1–3; the three commands, the db export, both READMEs |
| Tests | PASS | dump restorable (`pg_restore --list`), retention by prefix with foreign files kept, a failed dump that deletes nothing, guard pass/edited/older image/fresh database/unreachable database, counts kept, gained and lost, every usage error |
| Security | PASS | the URL reaches `pg_dump` as libpq variables only (shell `PG*` dropped), never printed (tests check the URL and a sentinel password are absent); dumps `0600` from the first byte (`wx` fd); table names validated then quoted; `spawn` without a shell |
| Data safety | PASS | retention only after a successful dump and only on `<prefix>-<timestamp>.dump`; the guard reads only; `--keep` below 1 is a usage error |
| Correctness | PASS | the guard runs `compareJournal`, so it refuses exactly what `softure migrate` refuses, plus the ledger module against `LEDGER_FILES` |
| Conventions | PASS | result values for expected failures, `CliFailure` exit codes 1 and 2, zod at the row-counts file boundary, English output |

## Findings

- **B1 (blocker, fixed):** the usage text did not list the three commands (the replacement missed the indented
  `help` line); found by running the built bin. Fixed, with a test that `help` names each command.
- **S1 (suggestion, fixed):** an IPv6 host kept its brackets (`[::1]`) in `PGHOST`; libpq wants the bare address.
- **S2 (suggestion, fixed):** `schema-guard` and `row-counts` passed any URL to `pg`; a `pglite://` URL now fails with
  the variable's name, never the URL.
- **W1 (warning, accepted):** `@softure-ai/deploy` now depends on `@softure-ai/db`, which brings PGlite and a
  `drizzle-orm` peer into a deploy CLI install. Accepted: one rule set for the guard outweighs the install size;
  `deploy` stays private until DP-8.
- **W2 (warning, deferred):** parity with FIRE_TRACKER's `deploy.sh` is unchecked (the session could not read it).
  Added to **DF-1** (`deploy-fire-parity`).
- **S3 (suggestion, deferred):** the table list in `deploy.json` (plan review S2). Recorded as **DF-2**
  (`deploy-row-count-config`), after DP-4.

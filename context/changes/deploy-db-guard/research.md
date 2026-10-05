# Research: deploy-db-guard

Date: 2026-10-05 · Sources: roadmap DP-3, `docs/06-fire-extraction-2.md`, `foundation/db/src/migrations/`
(`migrator.ts`, `ledger.ts`, `export.ts`, `problems.ts`), `tools/deploy/src/cli/` (DP-1), `.github/workflows/ci.yml`,
the PostgreSQL `pg_dump` and libpq environment documentation.

## What exists

- **The ledger** (`foundation/db/src/migrations/ledger.ts`): `softure.migrations (module, version, name, checksum,
  module_version, method, applied_at)`, read by `readJournal` (empty while the table does not exist). The ledger's own
  migration (`softure 0001_ledger`) ships as code in `LEDGER_FILES`.
- **The comparison** (`compareJournal` in `migrator.ts`): per module, an applied row without a file is
  `db.migration_missing`, a row whose file has another checksum or name is `db.migration_changed`, a pending file
  numbered below the last applied one is `db.migration_out_of_order`; the rest is pending. `describeProblem` prints
  each as one English line. `softure migrate --plan` already refuses the same cases, but it needs the app's config
  (the module list), which the deploy CLI does not have.
- **The image's files** (`export.ts`): the build stage runs `softure migrate --export-migrations <dir>`, which writes
  `<dir>/<module id>/NNNN_name.sql` for every enabled module with migrations. The ledger's own file is not exported.
- **The deploy CLI** (DP-1): `runCli(argv, io)` with a command table, `CliFailure` for expected failures (one line,
  exit 1; usage exit 2), `readFlags` with strict parsing. Commands are synchronous today.
- **CI**: the `test` job has a `postgres:16` service and `SOFTURE_TEST_POSTGRES_URL`; the `ubuntu-latest` runner ships
  the PostgreSQL client tools (`pg_dump` 16). Locally `pg_dump` 16.14 is installed with the server.
- **FIRE_TRACKER** `docker/server/deploy.sh`: could not be read from this session (DP-1 hit the same refusal). The
  behaviour comes from the roadmap item; parity is recorded as a follow-up gap (like DF-1 for DP-1).

## Answers to the roadmap unknowns

1. **Where the guard runs.** The guard takes a folder and a database URL, so it runs wherever both are reachable.
   The recommended place is the new image, before the switch: the image already holds the exported folder and joins
   the compose network (`docker compose run --rm --no-deps app npx softure-deploy schema-guard
   --migrations-dir=/app/migrations`). Running it on the host works too after `docker cp` of the folder. DP-5's
   generated `deploy.sh` makes the choice; this item only documents both.
2. **Which comparison.** Reuse the migrator's `compareJournal` through a new pure export in `@softure-ai/db`
   (`checkExportedMigrations(dir, journal)`), so the guard and `softure migrate` can never disagree. The ledger
   module (`softure`) is checked against `LEDGER_FILES`, so an image with an older `@softure-ai/db` than the database
   (a downgrade) is refused too. Ledger modules without a folder in the image are listed, not refused: the migrator
   ignores modules that are not enabled.

## Facts the code relies on

- `pg_dump` reads the connection from libpq variables (`PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`,
  `PGSSLMODE`, …). Passing the URL as an argument would put the password in the process list, so the URL is split
  into these variables.
- `pg_dump --format=custom` writes one compressed file restorable with `pg_restore`; written to stdout into a file
  opened with mode `0600`, the dump is never readable by others, even while it is written.
- `count(*)` on a quoted, validated identifier; `pg` parameters cannot carry identifiers.

## Risks

- **Production data:** a failing dump must never delete older dumps (retention runs only after a dump succeeded);
  the URL and password are never printed.
- **CLI entry conflicts:** commands become async (`runCli` returns a promise); DP-4 (verify, HTTP) needs the same.
  Resolved at merge time, `master` first.

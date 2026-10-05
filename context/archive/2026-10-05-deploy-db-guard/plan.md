# Plan: deploy-db-guard

Input: change.md, research.md. Complexity: medium (three commands, one export in `@softure-ai/db`).

## Goal

`softure-deploy backup`, `schema-guard` and `row-counts` exist, are documented in the package README and are tested
on a real Postgres in the normal `npm test` (skipped locally without `SOFTURE_TEST_POSTGRES_URL`, always run in CI).

**Out of scope:** the server `deploy.sh` and the place it runs the guard (DP-5); workflows (DP-2); restoring a dump;
a table list in `deploy.json` (DP-4 owns that file); publishing (DP-8).

## Approach

**Chosen:** pure functions in `tools/deploy/src/db/` (URL to libpq env, backup file names and retention, table list
parsing, count comparison) and thin I/O (a `pg` client, `pg_dump` through `spawn` without a shell). The guard's
comparison lives in `@softure-ai/db` as `checkExportedMigrations(migrationsDir, journal)`, built on
`compareJournal`. **Rejected:** shelling out to `psql` for the ledger (parsing text output); copying the comparison
into the deploy package (two rule sets that can drift); requiring the app config in the deploy CLI (the deploy
script has only the image and the URL).

## Phase 1: Ledger check in `@softure-ai/db`

**Discipline:** TDD.
**Files:** `foundation/db/src/migrations/exported.ts`, `foundation/db/src/index.ts`, `foundation/db/tests/exported.test.ts`.

1. `checkExportedMigrations(migrationsDir: URL, journal)`: reads each module folder (`readMigrationFiles`), adds the
   ledger unit, runs `compareJournal`; returns `{ pending, absent }` (absent: ledger modules with no folder) or the
   failure with every problem. A folder named after the reserved ledger id is a `db.reserved_module` problem.
2. Export it with `readJournal` and the `JournalRow` and `MigrationSession` types.
3. Tests (PGlite and fixtures in a temp folder): fresh database, all applied, pending files, an edited file, a missing
   file, out of order, an unknown ledger module, the ledger module newer than the package.

## Phase 2: Deploy commands

**Discipline:** TDD.
**Files:** `tools/deploy/src/db/{connection,backup,row-counts,schema-guard,index}.ts` and their tests,
`tools/deploy/src/cli/db-commands.ts`, `run.ts`, `main.ts`, `tests/cli.test.ts`, `tests/db-cli.test.ts`,
`tools/deploy/package.json`.

1. `toLibpqEnv(url)`: `postgres://`/`postgresql://` only; host, port, user, password, database and allowed query
   parameters (`sslmode`, `sslrootcert`, `sslcert`, `sslkey`, `host`, `port`, `connect_timeout`) as `PG*`; an unknown
   query parameter is refused by name.
2. `backup [--dir=backups] [--prefix=db] [--keep=7] [--url-env=DATABASE_URL] [--pg-dump=pg_dump]`:
   `<prefix>-<UTC yyyymmddThhmmssZ>.dump` written through a `0600` temporary file and a rename, then retention keeps the
   newest `--keep` dumps of the prefix. A failed `pg_dump` removes its temporary file, deletes nothing and prints its
   last stderr line.
3. `schema-guard --migrations-dir=<dir> [--url-env=DATABASE_URL]`: reads the journal on one connection, prints the
   pending files and absent modules, exits 1 with one line per problem.
4. `row-counts --tables=a,b.c [--out=<file>] [--compare=<file>] [--url-env=DATABASE_URL]`: names validated
   (`schema.table`, lower snake case), counts printed one per line, saved as JSON; `--compare` fails on a table with
   fewer rows than before or missing from the earlier file.
5. `runCli` becomes async; the database URL comes from the environment variable named by `--url-env` and is never
   printed, and driver errors print the message only.
6. Tests: pure units; CLI tests on a fresh Postgres database per test (dump and restore check with `pg_restore
   --list`, retention, guard pass and refusal, counts and a drop).

## Phase 3: Docs

**Discipline:** docs.
**Files:** `tools/deploy/README.md`, `foundation/db/README.md` (new export), roadmap rows.

1. README sections for the three commands with a `deploy.sh` sketch (order: backup → guard → counts before →
   switch → migrate → counts after) and where the guard can run.

## Progress

- [x] Phase 1: ledger check in `@softure-ai/db`
- [x] Phase 2: deploy commands
- [x] Phase 3: docs
- [x] Implementation review (`reviews/impl-review.md`): ready; B1, S1, S2 fixed; FIRE parity added to DF-1, DF-2 recorded

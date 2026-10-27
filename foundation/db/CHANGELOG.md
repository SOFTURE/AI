# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/db`. When an app has run a version in
production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done"). Versions before the first one below are described in their GitHub Releases (`db@x.y.z`).

## 0.1.14

- `createTestDatabase`: a query on the database's `db` or `client` made from inside one of its open transactions
  rejects at once with `PoolInsideTransactionError` (exported from `@softure-ai/db/testing`) instead of hanging until
  the test timeout: PGlite has one connection, so the call could never run (#785). Pass the transaction's `db`
  instead. Concurrent work outside the transaction's callback still waits and runs after it.

## 0.1.13

- `@softure-ai/db/testing/global-setup`, a Vitest `globalSetup` module: each module set is migrated once per run
  instead of once per test file (#641). The template is written to a folder the setup creates and removes
  (`SOFTURE_DB_TEST_TEMPLATES`), named by a hash of the module migration files, the drizzle folders' files and the
  baseline; every other file and worker loads it from disk. An app hook other than `drizzleAppMigrations` needs the
  new `templateKey` option to be shared; without it, its template stays per file as before.
- `createTestDatabase(modules, { reuse: true })`: `close()` returns the database to a pool and the next call gets it
  back reset to the template (rows, seed rows and ledgers, sequences, session state) in milliseconds instead of a new
  copy (~0.5 s). A database whose schema a test changed is replaced by a fresh copy.
- Without the setup and without `reuse`, nothing changes.

## 0.1.12

- `drizzleAppMigrations(folder, { migrationsTable, migrationsSchema })` names the drizzle ledger the folder uses
  (default `drizzle.__drizzle_migrations`, as before) (#534). Drizzle applies only files newer than the newest row of
  its ledger, so an `after` folder sharing the `before` folder's ledger skipped every file older than the newest
  `before` file on a fresh database, without an error. The README example now gives the `after` folder its own ledger.
- `migrate`, `planMigrations` (`--plan`) and `createTestDatabase` refuse `before` and `after` `drizzleAppMigrations`
  hooks on one ledger with the new problem `db.app_migrations_shared_ledger`, before anything runs. An app already
  running such an `after` folder: create the new ledger table in production and copy the `after` files' rows into it
  (matched by `hash`) before the first run on this version, or drizzle applies those files again.

## 0.1.11

- `createTestDatabase()` and `createPgliteHandle()` resolve only once PGlite is ready, so `close()` resolves on a
  database that was never queried (#523). Before, with PGlite 0.5.10, an `afterEach(close)` after a test that did not
  touch the database hung until the hook timed out. Nothing to migrate.

## 0.1.10

- `Queryable` is drizzle's driver-neutral `PgDatabase` base instead of a union of both drivers' databases and
  transactions, so `update(...).returning({ ...columns })` and `delete(...).returning({ ...columns })` type-check on
  it (#475). An app can drop a local cast to `PgDatabase<PgQueryResultHKT>` added for this.
- `execute()` on a `Queryable` resolves to the new `QueryableResult`: `rows`, `rowCount`, `command` and `fields`, the
  same fields the former union exposed, so code reading them compiles unchanged. New exported types:
  `QueryableResult`, `QueryableResultHKT`. Nothing to migrate.

## 0.1.9

- The `@softure-ai/core` range also accepts 0.2.0, so an app can install core 0.2.0 next to this version.

## 0.1.8

- `createProcessDatabase(url, { globalKey })` keeps the open database on `globalThis`, so a module `next dev`
  re-evaluates finds it; `closeProcessDatabases()` closes every process database, for tests (#404).
- `@softure-ai/db/testing`: `expectEntriesOpenDatabase({ entries, clientModule, opens })` and
  `findEntriesReachingDatabase(...)`, an entry-point guard over esbuild's import graph (`esbuild` is an optional
  peer) (#404).
- `drizzleAppMigrations(folder)`: an app migration hook running drizzle's migrator for the handle's driver (#404).
- `queryDatabase(handle, text, values)` and `openRawDatabase(url)`: parameterized raw SQL for scripts on either
  driver (#404).

## 0.1.7

- `createProcessDatabase(url, { schema, max })` returns `{ db, open, close, withDatabase, isOpen }`: a module-level,
  synchronous `db` over the process-wide handle for the URL. A query before `open()` throws `Database is not open`;
  `withDatabase(main)` opens, runs and closes for a script. `url` may be a function, read on `open()` (#313).
- `findDriverError(error)` (`{ code, constraint, message }` of the Postgres error under drizzle's wrapper) and
  `isConstraintViolation(error, { code, constraint })`, so apps and modules stop copying them (#313).
- `closeSharedDatabase(url)` closes and forgets one shared handle.

## 0.1.6

- One database handle per process: `getConfiguredDatabase` opens the config's `database.handle` or URL once, and modules, health route and commands share it.
- App migrations run around module migrations (`before` and `after` hooks).
- Adoption: app baselines, `--adopt <module>@<version> --through <n>`, dependencies adopted first, and modules whose SQL references app tables (stub tables).
- **Breaking:** `pg` and `@electric-sql/pglite` are optional peer dependencies, no longer dependencies. An app installs
  the driver its `DATABASE_URL` uses and lists `"@softure-ai/db"` and that driver in `serverExternalPackages`
  ([README §2](README.md#2-installation)); a URL whose driver is missing fails with a message naming the package.
- A migrate bundle keeps drizzle's driver adapters external (`--external:drizzle-orm/pglite`,
  `--external:drizzle-orm/node-postgres`).

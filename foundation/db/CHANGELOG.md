# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/db`. When an app has run a version in
production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done"). Versions before the first one below are described in their GitHub Releases (`db@x.y.z`).

## Unreleased

- `Queryable` is drizzle's driver-neutral `PgDatabase` base instead of a union of both drivers' databases and
  transactions, so `update(...).returning({ ...columns })` and `delete(...).returning({ ...columns })` type-check on
  it (#475). An app can drop a local cast to `PgDatabase<PgQueryResultHKT>` added for this.
- `execute()` on a `Queryable` resolves to the new `QueryableResult` (`{ rows }`). Code that read a driver-specific
  field (`rowCount`, `fields`) from it takes the `Database` or the handle instead. New exported types:
  `QueryableResult`, `QueryableResultHKT`.

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

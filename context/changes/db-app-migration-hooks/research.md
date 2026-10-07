# Research: db-app-migration-hooks

Input: [`change.md`](change.md), issue #153. Read: `foundation/db/src/**`, `foundation/db/tests/**`,
`foundation/core/src/module.ts`, `foundation/db/README.md`, docs/02 §4, docs/05, `drizzle-orm` 0.45 (`pg-core/dialect.js`,
`pglite/migrator`, `node-postgres/migrator`).

## 1. How migrations run today

- `migrate(handle, { modules, migrationsDir?, onApplied? })` (`migrator.ts`): `prepareUnits` validates every module
  and reads every file, then on one session (`withSession`) under `pg_advisory_lock` it compares the journal and
  applies pending files, one transaction each. Only module SQL; nothing an app can plug in.
- `runMigrateCli` (`cli/run.ts`) opens the database from `config.database.url` and calls `migrate`,
  `planMigrations` or `adoptModule`. `RunMigrateCliOptions` has `config`, `argv`, `cwd`, `output`.
- `createTestDatabase(modules)` (`testing.ts`, 52 lines on master; the issue cites a published build's line numbers)
  migrates a fresh PGlite once per module set (key: module id + migrations href) and copies the data folder per call.
  Confirmed: no way to create `public.*` before the modules.
- `RESERVED_SCHEMAS = { softure, public, information_schema }` plus `pg_*` and > 63 bytes.

## 2. Ordering

Two real dependencies, measured in the issue and true by construction:
- a module FK into an app table (`REFERENCES public.users`) needs the app migration first;
- an app migration that references a new module table needs the module first.

A single hook cannot satisfy both, two can: `before` (the app's history, normally all of it) and `after` (app files
that need module tables, kept in a second drizzle folder). Adoption order (app moves a table → adopt → migrate) is
#152's subject; the only touch here is that `--adopt` without `--plan` runs `before` first, so "the app migration that
moves the table" and "adopt" are one command, and the following `migrate` finds `before` already applied.

## 3. drizzle's migrator

- `migrate(db, { migrationsFolder })` from `drizzle-orm/node-postgres/migrator` or `drizzle-orm/pglite/migrator`
  creates `drizzle.__drizzle_migrations` (schema `drizzle` by default, `pg-core/dialect.js:45-54`) and runs every
  pending file in **one** transaction through `db` (its own connection from the pool for node-postgres).
- So the hook needs the drizzle database of the right driver: the `DatabaseHandle` union gives `handle.db` and
  `handle.kind`. Under node-postgres the hook uses another pool connection than the migrator's session; the advisory
  lock still serialises runners because it is held for the whole run. With a pool of `max: 1` the hook would wait
  forever: the CLI opens its own pool (default 10); the README says so for the programmatic `migrate`.
- `drizzle` is the ledger schema of every app on this stack: a module with `dbSchema: "drizzle"` would share it.
  Reserve it.

## 4. CJS bundles

Measured (esbuild 0.25, `--format=cjs`): `import.meta` becomes `{}`, so `new URL("../migrations/", undefined)`
throws `TypeError: Invalid URL` at module load, naming neither the module nor the cause. `runMigrateCli` itself has
no top-level await; the README's app script does (`process.exitCode = await runMigrateCli(...)`), which esbuild
refuses in CJS. Fix: `resolveMigrationsDir` throws an error naming the CJS bundle when it gets no module URL, and the
README says ESM only. A `.then` form would get past the top-level await, but module packages still need
`import.meta.url`, so a CJS bundle of the migrate step cannot work at all; the README says so instead of offering a
half-way form.

## 5. drizzle-kit generate

Not reproducible here without FIRE's setup, but the issue measured it on drizzle-kit 0.31.10: `schemaFilter` does not
stop `generate` from emitting `CREATE TABLE` for a re-exported module table. docs/02 §4's claim is wrong for
`generate`; the rule to write is "reference module tables (import them), never export them from the schema file
drizzle-kit reads".

## 6. Risks

- Collisions: #152 changes `adopt.ts` and possibly `run.ts` (`--adopt`); this change adds one call in `run.ts`'s adopt
  branch. #154 also touches `foundation/db`; #155 `core/src/config.ts` (not touched here). Master wins on conflict.
- A hook that throws after a partial run: drizzle's run is one transaction, so `before` is all or nothing for drizzle;
  module files before an `after` failure stay applied (as today when a file fails).

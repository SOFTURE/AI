# Plan: db-migrator

Input: change.md, research.md. Complexity: large (4 phases; data safety, two drivers, a catalog
comparison and a container path). Splitting was considered and rejected: the roadmap item is one
deliverable and each phase below is independently green.

## Goal

`@softure-ai/db` (`foundation/db/`) is a workspace package that builds with `tsc` and gives an app:

- `createDatabase(url)`: a drizzle database on `pg` (`postgres://`, `postgresql://`) or PGlite
  (`pglite://<dir>`, `pglite://` = in memory), with `Database`, `Queryable` and a `close()`;
- a migrator that applies every enabled module's SQL files in the module's own Postgres schema, in
  dependency order, recording each in `softure.migrations` with a sha256 checksum, under an
  advisory lock, one transaction per file; editing, deleting or reordering an applied file is
  refused before anything runs; `planMigrations` is the dry run;
- `adoptModule`: marks a module's migrations as applied after the live schema equals the schema
  those migrations produce, with a dry run;
- `createTestDatabase(modules)` (`@softure-ai/db/testing`): a migrated PGlite per call, cloned
  from a per-worker template;
- `softure migrate [--plan] [--adopt <module>@<version>] [--migrations-dir <dir>]
  [--export-migrations <dir>]` (bin and `runMigrateCli` in `@softure-ai/db/cli`), bundleable with
  esbuild for a container step.

Roadmap Baseline proven by tests: two dummy modules migrate in order on PGlite and Postgres;
re-running is a no-op; an edited migration fails; `--adopt` marks existing tables.

**Out of scope:** a Next.js adapter or a cached `globalThis` connection (FD-7 / identity ID-1);
`softure doctor`; down migrations; migrations that cannot run in a transaction
(`CREATE INDEX CONCURRENTLY`); comparing grants, comments, column order, row-level security
policies or view bodies in adopt; a lock wait timeout (a stuck runner is visible in `pg_locks`;
documented); any module package (FD-4 ships only dummy modules in tests).

## Approach

**Starting point:** `foundation/db/` is an empty shell (research §Current state). Core supplies
`SoftureModule.migrations: { dir: URL } | null`, `manifest.dbSchema` and
`sortModulesByDependencies` (`foundation/core/src/config.ts:73-80`). FIRE's client routing and
PGlite template cloning are the patterns to generalise (research §Current state).

**Chosen:** a small custom runner over one raw driver connection (pg `PoolClient` or the `PGlite`
instance) that needs only `query(text, params)` and multi-statement `exec(sql)`; drizzle only as
the query layer handed to app and module code. Rejected: drizzle's migrator per schema (needs
drizzle-kit journals, timestamp ordering, no checksum re-check, research answer 1); a DDL
checksum for adopt (the app's DDL differs by construction, research answer 2).

**Key decisions:**
| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Runner | custom, one connection, one transaction per file | plan, adopt, checksums, per-file rollback | research |
| Ledger | pseudo-module `softure` (schema `softure`), its migration shipped as TS code, applied first; missing table reads as empty journal | bootstraps through the normal path; bundles need no file for it | research |
| Ledger columns | `module, version, name, checksum, module_version, method ('applied' \| 'adopted'), applied_at`, PK `(module, version)`, CHECK on id, checksum and method | docs/02 §4 plus what adopt needs; invariants as constraints (AGENTS.md) | plan |
| File names | `NNNN_<lower_snake>.sql`, numbers 1..n without gaps or repeats; leading comment block must contain `Rollback:` | docs/02 §4, NFR-4; a gap usually means a deleted file | plan |
| Checksum | sha256 hex of the file with a BOM stripped and CRLF turned into LF | a Windows checkout must not look edited | plan |
| Schema placement | `CREATE SCHEMA IF NOT EXISTS "<schema>"; SET LOCAL search_path TO "<schema>", public` in each file's transaction | unqualified names land in the module schema | research |
| Verification | all problems across all modules collected before anything is applied | an edited file in module B must not leave module A half-migrated | plan |
| Lock | session-level `pg_advisory_lock` on a fixed key, held on the run's connection, journal read after the lock | a second runner waits, then finds nothing to do | research |
| Failures | `MigrationResult<T> = Ok<T> \| MigrationFailure` where `MigrationFailure extends Err<code>` with `problems: MigrationProblem[]` (discriminated by `code`); `describeProblem` gives the English line | expected failures are values and still name the file (AGENTS.md) | plan |
| Bad `DATABASE_URL` scheme | thrown `Error` naming the scheme only, never the URL | a deployment bug; the URL holds a password | plan |
| Reserved | module id `softure` and `dbSchema` `softure`, `public`, `information_schema`, `pg_*` or longer than 63 bytes refused (`db.reserved_module`); a module with migrations but no `dbSchema` refused | the ledger owns `softure`, `public` is the app's, Postgres truncates long names (plan review W6) | research, plan review |
| Failure code | `MigrationFailure.error` is the code of the first problem; `problems` holds all of them | one switchable code plus full detail (plan review S3) | plan review |
| Renames and transaction control | an applied file whose name changed is `db.migration_changed`; a file with a `BEGIN;`, `COMMIT;`, `ROLLBACK;` or `START TRANSACTION` statement line is invalid | both silently defeat the ledger or the per-file transaction (plan review S4, S6) | plan review |
| Pooled connection | the migration connection is destroyed after the run (`release(true)`), never returned to the pool | a file's plain `SET` or a failed unlock must not leak into the app's pool (plan review W5) | plan review |
| Adopt method | reference = scratch PGlite migrated with the listed modules up to the adopted one; compare tables and other relations, columns (type, not null, default, identity, generated), constraints (`contype` p, u, f, c, x by name and definition), indexes, triggers, functions, types (enum labels), all read with `search_path = pg_catalog`; any difference refuses | strict equality is the only safe answer; PG 18 not-null rows excluded (research §Risks) | research |
| Adopt version | `<module>@<version>` must equal the enabled module's `manifest.version` | the owner adopts the version they reviewed | plan |
| Dependencies | `pg`, `@electric-sql/pglite` and `@types/pg` (its `Pool` is in the public types) dependencies, drivers loaded by dynamic `import()`; `drizzle-orm` peer `^0.45.2`; `@softure-ai/core` dependency | bundles keep drivers external; one drizzle shared with modules (plan review S1, S2) | research, plan review |
| CLI | `runMigrateCli({ config, argv, output })` returns an exit code; bin `softure migrate --config <file>` loads the app config by dynamic import (default export or `config`); a `.ts` config works only where Node can strip its types (documented), otherwise the app's script is the path | the app's `scripts/migrate.ts` is the bundle entry, the bin is the dev path (plan review W8) | plan, plan review |
| Bundle path | `--export-migrations <dir>` copies each enabled module's files to `<dir>/<id>/` (build stage); `--migrations-dir <dir>` reads them there (bundled run) | `import.meta.url` does not survive bundling (research answer 4) | research |

**Critical details:**
- The advisory lock is session-level: every statement of a run, including `BEGIN`/`COMMIT`, must go
  through the one acquired `PoolClient`, never through `pool.query`, or the lock and the
  transaction land on different connections.
- A failed `exec` leaves the PGlite or pg session in an aborted transaction; the runner always
  issues `ROLLBACK` before reporting, and releases the lock in a `finally`.
- `pg_get_*` output depends on `search_path`; introspection runs inside a transaction with
  `SET LOCAL search_path = pg_catalog` on both databases, so names are qualified identically.

## Phase 1: Package shell, client and migration files

**Discipline:** TDD. **Files:** `foundation/db/package.json`, `tsconfig.json`, `tsconfig.build.json`,
`src/index.ts`, `src/client.ts`, `src/migrations/files.ts`, `src/migrations/problems.ts`,
`tests/client.test.ts`, `tests/files.test.ts`, `tests/fixtures/**`, root `package.json`,
`package-lock.json`; delete the `.gitkeep` files and `foundation/db/migrations/`.

1. `foundation/db/package.json`: shell like `foundation/core/package.json` (repository, files `dist`,
   `src`, `!src/**/*.test.ts(x)`, publishConfig), exports `.`, `./testing`, `./cli` (the last two
   added in their phases), dependencies `@softure-ai/core` (`^0.0.0`), `pg`, `@electric-sql/pglite`,
   peer `drizzle-orm`; devDependencies at the root: `drizzle-orm`, `@types/pg`.
2. `src/client.ts`: `createDatabase(url: string, options?: { max?: number }): Promise<DatabaseHandle>`.
   Contract: `DatabaseHandle = { kind: "postgres"; db: PostgresDatabase; pool: Pool; close() } |
   { kind: "pglite"; db: PgliteDatabase; client: PGlite; close() }`; `Database = DatabaseHandle["db"]`;
   `Queryable = Database | <transaction type of each>` (FIRE `client.ts` pattern). Unsupported
   scheme throws `Error("createDatabase: unsupported DATABASE_URL scheme \"mysql:\" …")`.
3. `src/migrations/files.ts`: `readMigrationFiles(moduleId, dir: URL)` → `{ files } | problems`;
   `MigrationFile = { version, name, fileName, sql, checksum }`; `computeChecksum(sql)`; name,
   numbering and rollback-comment rules from Key decisions; non-`.sql` files ignored; a missing or
   unreadable folder is a problem, not a throw.
4. `src/migrations/problems.ts`: the `MigrationProblem` union (codes: `db.invalid_migration_file`,
   `db.migrations_unreadable`, `db.migration_changed`, `db.migration_missing`,
   `db.migration_out_of_order`, `db.migration_failed`, `db.reserved_module`,
   `db.migrations_without_schema`, `db.dependency_cycle`, `db.adopt_unknown_module`,
   `db.adopt_version_mismatch`, `db.adopt_already_applied`, `db.schema_mismatch`),
   `MigrationResult<T>`, `describeProblem`.

**Tests:** client on `pglite://` (memory) and on a temp dir (data survives close and reopen),
`select 1` through drizzle, a transaction through a `Queryable` helper, unsupported scheme message
without the password; files: valid folder sorted by number, CRLF and LF give one checksum, bad
name, gap, repeated number, missing `Rollback:`, empty folder (no files, no problem), missing folder.

**Done when:**
- Automated: the phase 1 tests fail before the sources exist and pass after.
- Automated: `npm run build` emits `foundation/db/dist/index.js` and `index.d.ts`.
- Automated: Gates green (typecheck, lint, test).

## Phase 2: Migrator, ledger and test database

**Discipline:** TDD. **Files:** `src/migrations/ledger.ts`, `src/migrations/session.ts`,
`src/migrations/migrator.ts`, `src/testing.ts`, `src/index.ts`, `tests/migrator.test.ts`,
`tests/testing.test.ts`, `tests/support/drivers.ts`, `tests/fixtures/modules.ts`,
`.github/workflows/ci.yml`.

1. `src/migrations/session.ts`: `withSession(handle, run)` gives one connection exposing
   `query<T>(text, params?)` and `exec(sql)` (pg: `pool.connect()`, then `release(true)` so the
   client is destroyed, never pooled again; PGlite: the instance, with `RESET ALL` after the run).
2. `src/migrations/ledger.ts`: the ledger migration as a `MigrationFile` of module `softure`
   (`0001_ledger`; a test pins its sha256: never edit it, add `0002`), `readJournal(session)` (empty when `to_regclass('softure.migrations')` is null),
   `recordMigration(session, row)`.
3. `src/migrations/migrator.ts`: `planMigrations(handle, { modules, migrationsDir? })` →
   `MigrationResult<MigrationPlan>` (no lock, no writes); `migrate(handle, { modules, migrationsDir? })`
   → `MigrationResult<MigrationReport>`. Order: reserved and schema checks, sort, read files, take
   the lock (migrate only), read journal, compare (changed or renamed, missing, out of order; journal rows of
   modules not listed are ignored), apply pending files one transaction each with their ledger row.
   `migrationsDir` replaces each module's `migrations.dir` with `<migrationsDir>/<id>/`.
   Contract: `MigrationStep = { module, schema, version, name, checksum }`;
   `MigrationPlan = { pending: MigrationStep[] }`; `MigrationReport = { applied: MigrationStep[] }`.
4. `src/testing.ts`: `createTestDatabase(modules)` → `{ db, client, close }`; a template per module
   set (keyed by ids and folders) migrated once per worker with `migrate`, then `loadDataDir` per
   call; migration problems throw with every `describeProblem` line.
5. `tests/support/drivers.ts`: a PGlite driver and a Postgres driver that creates a fresh database
   per test from `SOFTURE_TEST_POSTGRES_URL` and drops it after; without the variable the Postgres
   cases skip locally and fail in CI (`CI` set).
6. `.github/workflows/ci.yml`: the `test` job gets a `postgres:16` service and the variable.

**Tests (each on PGlite and Postgres):** two modules listed dependent-first migrate in dependency
order into their schemas (ledger rows `softure 1, notes 1, notes 2, tags 1`; `tags` has an FK to
`notes`); a second run applies nothing and leaves the ledger unchanged; an edited applied file
gives `db.migration_changed` and applies nothing, also in another module; a deleted applied file
gives `db.migration_missing`; a new file is applied alone; a pending number below an applied one
gives `db.migration_out_of_order`; a failing second file keeps the first committed and leaves no
row, table or schema change from the failing one; plan on an empty database lists the ledger and
all files and creates nothing (no `softure` schema afterwards); reserved id or schema, migrations
without schema and a cycle are reported without touching the database. Postgres only: two
concurrent `migrate` calls on two handles apply each file exactly once. `createTestDatabase`: two
calls give independent databases with the module tables; a broken migration throws naming the file;
a renamed applied file gives `db.migration_changed`; `public`, `pg_x`, `information_schema` and a
64-byte schema are refused; a file with `COMMIT;` is invalid; a file running a plain
`SET search_path` does not change the search path of a later pooled query (Postgres). The
concurrency case uses a fixture file with `pg_sleep(0.5)`, so the second runner provably waits.

**Done when:**
- Automated: the phase 2 tests fail before the sources exist and pass after.
- Automated: the Postgres cases pass against a local PostgreSQL 16 with `SOFTURE_TEST_POSTGRES_URL` set.
- Automated: a query of `softure.migrations` after the two-module run returns exactly the four
  expected rows with method `applied` (asserted in the test on both drivers).
- Automated: Gates green (typecheck, lint, test).

## Phase 3: Adoption

**Discipline:** TDD. **Files:** `src/migrations/introspect.ts`, `src/migrations/adopt.ts`,
`src/index.ts`, `tests/adopt.test.ts`.

1. `src/migrations/introspect.ts`: `describeSchema(session, schema)` → a sorted list of lines, one
   per object (`table notes.notes`, `column notes.notes.title text not null default …`,
   `constraint notes.notes notes_pkey PRIMARY KEY (id)`, `index …`, `trigger …`, `function …`,
   `type …`), read inside a transaction with `SET LOCAL search_path = pg_catalog`.
2. `src/migrations/adopt.ts`: `adoptModule(handle, { modules, module, version, dryRun?, migrationsDir? })`
   → `MigrationResult<AdoptionReport>`; checks: module listed, version equal, no ledger row for it,
   the usual file and journal checks for every module before it; builds the reference on a scratch
   PGlite with `migrate` on the modules up to and including the adopted one; compares
   `describeSchema` of both; on equality writes one ledger row per file with method `adopted` in
   one transaction (skipped on `dryRun`). The lock is taken first and everything (journal read,
   introspection, comparison, write) runs under it; the ledger migration is applied first when
   pending (reported, skipped on `dryRun`); every listed dependency of the module must have all its
   files in the journal, else `db.adopt_dependency_pending` (new problem code). Introspection skips
   dropped columns (`attisdropped`, `attnum <= 0`) and objects owned by extensions
   (`pg_depend.deptype = 'e'`) and lists sequences by name. Differences are reported as
   `missing in database: …` / `unexpected in database: …` lines.
   Contract: `AdoptionReport = { module, version, adopted: MigrationStep[], dryRun: boolean }`.

**Tests (PGlite and Postgres):** an app that built `notes` tables in `public` with equivalent DDL and
moved them with `ALTER TABLE … SET SCHEMA notes` is adopted (dry run writes nothing; real run writes
`adopted` rows; a later `migrate` applies only the newer file and keeps the data rows); a missing
column, a different type, an extra index and a renamed constraint each refuse with the matching
line and write nothing; wrong version, unlisted module and an already applied module are refused;
adopting `tags` (depends on `notes`) after `notes` is migrated succeeds, and is refused while `notes`
is not in the journal; adopt on a database without the ledger creates it (not on a dry run); the
adopted fixture has an identity column, a serial column (its sequence moved with `SET SCHEMA`) and
a column the app dropped earlier; a sequence left behind in `public` while its table moved refuses.

**Done when:**
- Automated: the phase 3 tests fail before the sources exist and pass after.
- Automated: after adoption a `select count(*)` on the moved table returns the rows inserted before
  the move (asserted in the test).
- Automated: Gates green (typecheck, lint, test).

## Phase 4: CLI, container bundle and docs

**Discipline:** TDD for the CLI, test-after for the bundle and docs. **Files:** `src/cli/run.ts`,
`src/cli/bin.ts`, `src/cli/index.ts`, `src/migrations/export.ts`, `package.json` (`bin`, `./cli`),
`tests/cli.test.ts`, `tests/bundle.test.ts`, `tests/fixtures/bundle-entry.ts`, root `package.json`
(esbuild devDependency), `foundation/db/README.md`, `docs/02-module-standard.md` §4,
`docs/05-adoption-playbook.md` step 3.

1. `src/migrations/export.ts`: `exportMigrations(modules, targetDir)` copies each module's valid
   files to `<targetDir>/<id>/` and returns the copied steps, or problems.
2. `src/cli/run.ts`: `runMigrateCli({ config, argv, output })` → exit code (0 done, 1 problems or
   failure, 2 usage); parses with `node:util` `parseArgs`; prints one line per step and
   `describeProblem` lines; needs `config.database` except for `--export-migrations`; closes the
   database in `finally`; prints thrown errors by message only.
3. `src/cli/bin.ts`: `#!/usr/bin/env node`; `softure migrate [--config <file>] …`; finds
   `softure.config.{ts,mts,js,mjs}` in the working directory when `--config` is absent; the config
   is the default export or `config`, and must have `modules`.
4. `tests/bundle.test.ts`: esbuild bundles `tests/fixtures/bundle-entry.ts` (fixture config +
   `runMigrateCli`) to ESM with `pg` and PGlite external and `conditions: ["@softure-ai/source"]`
   (CI's test job has no `dist/`) into `node_modules/.cache/`; it also bundles `src/cli/bin.ts`
   and a fixture config to `.mjs` and spawns `node bin.mjs migrate --config config.mjs` (real Node,
   not Vite). The test
   exports migrations to a temp folder, runs `node bundle.mjs --migrations-dir <dir>` against a
   `pglite://<tmp>` URL, and reads the ledger.
5. README with the twelve sections; docs/02 §4 and docs/05 step 3 updated with the decided CLI
   flags, the export/migrations-dir container steps, the adopt comparison, that adopt and
   `createTestDatabase` need PGlite installed (also in an image that runs on `pg`), that a
   transaction-mode PgBouncer breaks the session lock, and the `.ts` config limits.

**Tests:** CLI: migrate prints applied steps and exits 0; second run prints nothing to apply;
`--plan` lists pending and writes nothing; `--adopt notes@0.1.0 --plan` and without; malformed
`--adopt` exits 2; unknown flag exits 2; no `database` in config exits 1 with a message; a problem
exits 1 with the file named; `--export-migrations` writes the folders without a database; the bin
loads a fixture config (default export and named `config`), rejects a file without `modules` and a
missing file, and finds `softure.config.mjs` in the working directory when `--config` is absent.

**Done when:**
- Automated: the phase 4 CLI tests fail before the sources exist and pass after.
- Automated: the bundle test runs the bundled CLI and finds the four ledger rows.
- Automated: `npm run build` emits `dist/cli/bin.js` starting with `#!/usr/bin/env node`.
- Automated: README and docs links pass the link test; the package passes `tests/repo/packages.test.ts`.
- Automated: Gates green (typecheck, lint, test).

## Risks and rollback

- Wrong adopt result on a real database → strict equality, dry run first in the playbook, every
  difference printed; rollback: `DELETE FROM softure.migrations WHERE module = '<id>' AND method = 'adopted'`.
- Ledger corruption → it is append-only through the runner; rollback of the ledger migration:
  `DROP SCHEMA softure CASCADE` (forgets history, keeps module data).
- Postgres-only behaviour missed by PGlite → every migrator test runs on both drivers, CI runs Postgres.
- Each phase is additive inside `foundation/db/` (plus ci.yml and docs); reverting a phase commit
  undoes it. Nothing is published (FD-8).

## Decisions (auto)

- Complexity → large, kept as one change (one roadmap deliverable; phases are green increments).
- Phase outline → as written (client and files; migrator; adopt; CLI and bundle).
- Cached `globalThis` connection for Next dev → out of scope (FD-7 / ID-1 decide the adapter).
- `module_version` of the ledger's own rows → `1.0.0`, the ledger format version, not the package
  version, so release bumps never touch code.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Package shell, client and migration files

#### Automated
- [ ] 1.1 The phase 1 tests fail before the sources exist and pass after
- [ ] 1.2 `npm run build` emits `foundation/db/dist/index.js` and `index.d.ts`
- [ ] 1.3 Gates green (typecheck, lint, test)

### Phase 2: Migrator, ledger and test database

#### Automated
- [ ] 2.1 The phase 2 tests fail before the sources exist and pass after
- [ ] 2.2 The Postgres cases pass against a local PostgreSQL 16 with `SOFTURE_TEST_POSTGRES_URL` set
- [ ] 2.3 After the two-module run `softure.migrations` holds exactly the four expected rows with method `applied`, on both drivers
- [ ] 2.4 Gates green (typecheck, lint, test)

### Phase 3: Adoption

#### Automated
- [ ] 3.1 The phase 3 tests fail before the sources exist and pass after
- [ ] 3.2 After adoption the moved table still holds the rows inserted before the move
- [ ] 3.3 Gates green (typecheck, lint, test)

### Phase 4: CLI, container bundle and docs

#### Automated
- [ ] 4.1 The phase 4 CLI tests fail before the sources exist and pass after
- [ ] 4.2 The bundle test runs the bundled CLI and finds the four ledger rows
- [ ] 4.3 `npm run build` emits `dist/cli/bin.js` starting with `#!/usr/bin/env node`
- [ ] 4.4 README and docs links pass the link test and the package passes `tests/repo/packages.test.ts`
- [ ] 4.5 Gates green (typecheck, lint, test)

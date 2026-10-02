# Research: db-migrator

Input: change.md, roadmap FD-4, research.sources (`docs/`, `../../FIRE_TRACKER/` read from a
clone of jarmatys/FIRE_TRACKER at `/home/claude/fire_tracker`). Depth: deep (data migrations,
data safety for every adopting app).
Snapshot: 3282cd7 on claude/fd-4-db-migrator-rm9sg7, 2026-10-02 13:55 Europe/Warsaw.

## Summary

- `foundation/db/` is an empty shell (README and `.gitkeep` files); nothing to keep or migrate.
- The module contract it consumes exists in `@softure-ai/core`: `SoftureModule.migrations` is
  `{ dir: URL } | null` (`foundation/core/src/module.ts:31-34,68`), `manifest.dbSchema` is a
  lower_snake identifier or null (`manifest.ts:28`), and `sortModulesByDependencies` returns the
  migration order or `core.dependency_cycle` (`config.ts:73-80`).
- Drizzle's migrator cannot be reused: it needs drizzle-kit's `meta/_journal.json`, picks pending
  files by timestamp only, never re-checks applied checksums, and runs everything in one
  transaction (drizzle-orm 0.45.3 `pg-core/dialect.js:44-72`, `migrator.js:6-21`). A small custom
  runner over the raw drivers is simpler and gives plan, adopt, per-module schemas and checksums.
- Both drivers were probed live: PGlite 0.5.8 is PostgreSQL 18.3, supports `pg_advisory_lock`,
  multi-statement `exec`, and `dumpDataDir`/`loadDataDir` cloning; a local PostgreSQL 16.14
  server runs in this container (no Docker daemon), so the Postgres path is testable here and in CI.
- `--adopt` must compare catalogs (tables, columns, constraints, indexes, ...) of the target
  schema with a reference database built by applying the same migrations on PGlite. A DDL checksum
  cannot work: the adopting app built its tables with different DDL.
- Bundling breaks `new URL("../migrations/", import.meta.url)`: the container step needs a way to
  read migrations from a copied folder.

## Current state

- `foundation/db/README.md:1-15`: the intended API (client, migrator, `createTestDatabase`), no code.
- `foundation/db/{src/server,migrations,tests}/.gitkeep`: empty.
- No package uses a database yet. `ModuleContext<TDatabase = unknown>` leaves the db type to this
  package (`foundation/core/src/module.ts:12-18`).
- `SoftureConfig.database` is `{ url } | null`, required once any module has a `dbSchema`
  (`foundation/core/src/config.ts:10-12,183-190`); two modules on one schema are rejected at
  config time (`config.ts:117-123`).
- `defineModule` requires `migrations` when `dbSchema` is set and only accepts `file:` URLs
  (`module.ts:126-131`); it does **not** reject migrations on a module without `dbSchema`.

FIRE_TRACKER today (the source the package generalises):
- `src/db/client.ts`: driver chosen by `DATABASE_URL` prefix `pglite://` vs Postgres, `Database` as
  a union of both drizzle types, `Queryable` adds the transaction type, lazy `globalThis` cache.
- `scripts/migrate.ts`: same routing, drizzle migrator on `./drizzle`, one journal for the whole app.
- `src/db/test-db.ts`: PGlite template migrated once per worker, then `dumpDataDir`/`loadDataDir`
  per test (measured there: ~2 s per fresh migrated PGlite vs ~0.4 s per clone).
- `docker/Dockerfile:102,137`: esbuild bundles `scripts/migrate.ts` to CJS with `pg` and PGlite
  external; the image copies `drizzle/` next to `migrate.cjs`.

## Affected surface

| Area | Files | Why |
| --- | --- | --- |
| New package | `foundation/db/**` | the whole deliverable; exclusively owned by FD-4 |
| Workspace | `package.json`, `package-lock.json` | new dependencies (pg, PGlite, drizzle-orm, esbuild for the bundle test) |
| CI | `.github/workflows/ci.yml` | a Postgres service for the real-Postgres tests |
| Docs | `docs/02-module-standard.md` §4, `docs/05-adoption-playbook.md` | record the decided CLI shape and adopt method |

## Data

The package creates its own schema `softure` with one ledger table `softure.migrations`
(docs/02 §4: `module, version, name, checksum, applied_at`). No other data. Module schemas are
created by the migrator from `manifest.dbSchema`.

## Tests

- Runner: Vitest at the root, `foundation/*/tests/**/*.test.ts` (`vitest.config.mts:30-33`), random
  order, `TZ=America/New_York`, `NODE_ENV=test`, 60 s timeout.
- `tests/repo/packages.test.ts` checks every workspace package's shape (name, ESM, engines,
  `tsc` build, exports order, release rules from FD-2: `repository`, `files` with `dist`, `src`,
  `!src/**/*.test.ts(x)`, `publishConfig`).
- PGlite runs inside Vitest without a server. A PostgreSQL 16 server can be started here from
  `/usr/lib/postgresql/16/bin`; CI can use a `postgres` service container. Docker Hub may answer
  429 locally, but there is no Docker daemon here anyway.
- Gap: nothing tests the container path today; FIRE has no test for its bundle either.

## Patterns to follow

- Package shell: copy of `templates/package/` minus module-only parts; `foundation/core/package.json`
  is the closest example (no `module.json`, README with the 12 sections).
- Errors: expected failures as values (`Result` from core, `foundation/core/src/result.ts`), config
  bugs as thrown errors listing every issue (`SoftureConfigError`, `config-error.ts`).
- Imports with `.js` suffixes, `verbatimModuleSyntax`, `noUncheckedIndexedAccess`
  (`tsconfig.base.json`).
- Tests build and clean up their own data (AGENTS.md); FIRE's per-test PGlite clone is the pattern.

## Prior work

- `context/archive/2026-10-02-core-contract/plan.md`: decided `migrations: { dir: URL }` and that
  reading the files belongs to FD-4 (Out of scope line).
- `context/archive/2026-10-02-monorepo-tooling/`: tsc builds only, bundlers only as an extra
  output for code without directives (L-001).
- FD-2 (`3282cd7`): release rules every package must pass.

## SOFTURE modules

Not applicable: this is the foundation package the modules stand on. The `ops` module row in
docs/01 mentions a `softure migrate` CLI for Docker images; FD-4 builds that CLI here, `ops` can
re-export or wrap it later.

## Risks

- **Data loss on a misapplied migration** (medium): each migration runs in its own transaction
  with its journal row; a failure rolls back that file only and stops the run.
- **Concurrent deploys** (medium): two containers migrating at once. Mitigation: a session-level
  advisory lock held on one dedicated connection for the whole run; the second runner re-reads the
  journal after the lock and finds nothing to do.
- **Edited or deleted migrations** (high impact): checksum and presence checks on every run,
  before anything is applied.
- **False adopt** (high impact): marking migrations as applied on a schema that differs. Strict
  catalog comparison including constraint and index names; any difference refuses adoption.
- **Cross-version catalogs** (medium): PGlite is PG 18, servers may be PG 16. PG 18 stores NOT NULL
  as `pg_constraint` rows (`contype = 'n'`), which PG 16 lacks; compare nullability through
  `attnotnull` and exclude `contype = 'n'`.
- **Secrets**: `DATABASE_URL` holds a password; never print it in errors or logs.
- **Collisions with in-flight changes**: FD-5 owns `foundation/ui/`; the shared files are
  `package.json` and `package-lock.json` (roadmap rule: take master's lockfile, re-run install).

## Relevant lessons

- L-001: the package build stays `tsc -p tsconfig.build.json`; the container bundle (esbuild) is an
  extra output made by the app, and db code carries no directives.

## Answers to unknowns

1. **Reuse drizzle's migrator per schema, or a custom runner?** Custom runner. Evidence above
   (drizzle needs `_journal.json`, timestamps not numbers, no checksum check of applied files,
   one transaction for all). The runner needs only `query(text, params)` and multi-statement
   `exec` on one connection, which both `pg.PoolClient` and `PGlite` offer.
2. **`--adopt` comparison: information_schema diff vs checksum of expected DDL?** Catalog diff
   against a reference: apply the listed modules' migrations up to the adopted module on a scratch
   PGlite, introspect the module schema in both databases through `pg_catalog`
   (`format_type`, `pg_get_constraintdef`, `pg_get_indexdef`, `pg_get_triggerdef`,
   `pg_get_expr`) with `search_path = pg_catalog` so every name is qualified, and require equality.
   A DDL checksum is impossible because the app reached the shape through its own DDL.
3. **How are module SQL files placed in their schema?** The migrator runs `CREATE SCHEMA IF NOT
   EXISTS` and `SET LOCAL search_path TO <schema>, public` inside each migration's transaction, so
   unqualified names land in the module schema; references to other modules stay qualified.
4. **Bundle-friendly container step?** `import.meta.url` is meaningless after bundling, so module
   folders cannot be found from a bundle. A copied-migrations folder (`<dir>/<module-id>/*.sql`)
   that the bundled runner reads instead solves it; the db package's own ledger migration ships
   as code so the bundle needs no file for it. Drivers load through dynamic `import()` so a bundle
   can keep `pg` and PGlite external, as FIRE does.
5. **Where does the ledger migration live?** The db package is itself a migration owner
   (pseudo-module `softure`, schema `softure`), applied first; while the table does not exist the
   journal reads as empty, so the first run bootstraps through the normal path.

## Open questions

- Is `softure` reserved as a module id and schema? **Decided (auto):** yes, the migrator refuses a
  module with id or `dbSchema` `softure`, since the ledger owns that schema.
- Driver dependencies: **decided (auto):** `pg` and `@electric-sql/pglite` are dependencies,
  loaded lazily; `drizzle-orm` is a peer dependency so modules and the app share one drizzle
  (type identity of tables across packages).
- A module with migrations but no `dbSchema` (allowed by core): **decided (auto):** the migrator
  reports it as a problem and applies nothing; every module migration has a schema (docs/02 §4).
- Nothing escalated.

## Decisions (auto)

- Depth `deep` (data migrations, adoption of production data).
- No subagent fan-out: the surface is one empty package plus the core contract; the central
  files were read directly and the driver behaviour was probed live instead.

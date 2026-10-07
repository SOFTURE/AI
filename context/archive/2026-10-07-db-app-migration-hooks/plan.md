# Plan: db-app-migration-hooks

Input: change.md, research.md (framing skipped, reason in change.md). Complexity: medium (two phases).

## Goal

- `AppMigrations { before?, after? }`, each `(handle: DatabaseHandle) => Promise<void>`, exported from
  `@softure-ai/db`.
- `migrate(handle, { modules, app })`: after the checks pass and under the lock, `before` → pending module files →
  `after`. A hook that throws (or rejects) becomes `{ code: "db.app_migration_failed", phase, reason }`; `before`
  failing stops the run before any module file, `after` failing leaves the module files applied. The report gains
  `app: ("before" | "after")[]`, the phases that ran. `planMigrations` ignores `app` (hooks cannot be planned).
- `runMigrateCli({ ..., app })`: migrate runs the hooks and prints `applied app migrations (before)` /
  `(after)`; `--plan` prints that app migrations are not planned; `--adopt` without `--plan` runs `before` first
  (under the lock), so the app migration that moves a table and the adoption are one command.
- `createTestDatabase(modules, { app })`: the template runs the hooks; the cache key holds each hook's identity.
- `drizzle` added to the reserved schemas.
- `resolveMigrationsDir` with no module URL throws naming the CJS bundle and `--format=esm`.
- README (§4 app migrations + drizzle recipe + ESM only, §5 order, reserved schemas, tests), docs/02 §4 (who runs app
  migrations, order, `drizzle-kit generate` caveat, reserved `drizzle`), docs/05 step 3 (order with hooks).
- Versions: `@softure-ai/db` 0.1.6, `@softure-ai/core` 0.1.6 (and the lockfile).

**Out of scope:** adoption baselines and dependency ordering inside `adoptModule` (#152), hooks in the config / the
`softure` bin (needs `core/src/config.ts`, #155's), any change in an adopting app.

## Key decisions

- **One option name, `app`, everywhere** (the issue wrote `{ setup }` for the test database): the same object goes to
  the CLI script and to the tests, so an app defines it once (`softure.migrations.ts`) and passes it to both.
- **Hooks get the `DatabaseHandle`**, not the migrator's session: drizzle's migrator needs a drizzle database, and
  `handle.kind` picks `drizzle-orm/node-postgres/migrator` or `drizzle-orm/pglite/migrator`.
- **Inside the lock**: two runners never run the app's migrations at once (drizzle's own run has no lock).
- **Hooks run on every migrate**, even with nothing pending for modules: they are the app's own idempotent runners.
- **Hooks are skipped when the checks fail** (edited file, reserved schema): nothing runs when the run is refused.
- **Template key by function identity** (a `WeakMap` numbering each hook): two different hooks never share a
  template; the same hook object reuses it. A hook rebuilt per call (an inline arrow inside the test) misses the
  cache, which the README says: define the hooks once at module level.

## Phase 1: hooks in migrate, CLI and test database (TDD)

- `tests/app-migrations.test.ts` on both drivers (`createTestDrivers`): a fixture module `linked` whose 0001 has an
  FK into `public.app_users`;
  - without `before` → `db.migration_failed` naming `relation "public.app_users" does not exist`;
  - `before` creates `public.app_users` → applied; `after` creates `public.user_links` referencing `linked.links` →
    exists; report `app` is `["before", "after"]` and the hooks ran in that order around the module file;
  - `before` throws → `db.app_migration_failed` phase `before`, no module file in the ledger, `after` not called;
    the reason carries the cause chain (drizzle wraps the Postgres error, plan review F1);
  - `after` throws → module file applied, problem phase `after`;
  - refused run (reserved schema) → no hook called;
  - nothing pending → hooks still run once;
  - the drizzle recipe: a fixture drizzle folder (`meta/_journal.json` + `0000_app_users.sql`) applied through the
    driver's drizzle migrator in `before`; second run applies nothing and `drizzle.__drizzle_migrations` has one row;
  - `dbSchema: "drizzle"` → `db.reserved_module`.
- `tests/cli.test.ts`: `app` hooks print the two lines; `--plan` prints the not-planned line and calls no hook;
  `--adopt` without `--plan` calls `before` (with a module whose schema the hook creates) — adopt test needs PGlite.
- `tests/testing.test.ts`: `createTestDatabase([linked])` throws on the FK; with `{ app: { before } }` works; the
  same hook object builds the template once (call counter); a different hook builds another.
- Code: `migrator.ts`, `problems.ts`, `cli/run.ts`, `testing.ts`, `index.ts` exports.

Done when: the new tests seen red first (no `app` option), then green; gates green.

## Phase 2: CJS guard, docs, versions

- `core/tests/module.test.ts`: `resolveMigrationsDir(undefined)` throws `/CJS bundle.*--format=esm/`; code in
  `core/src/module.ts`.
- README, docs/02 §4, docs/05 as in Goal; versions and lockfile.

Done when: the guard test seen red, then green; `npm run typecheck|lint|test|build` green; repo tests (links) green.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: hooks in migrate, CLI and test database

#### Automated
- [x] 1.1 Hook tests seen red, then green — f4a5bf4
- [x] 1.2 migrate, runMigrateCli and createTestDatabase take `app` — f4a5bf4
- [x] 1.3 `drizzle` reserved — f4a5bf4

### Phase 2: CJS guard, docs, versions

#### Automated
- [x] 2.1 resolveMigrationsDir guard seen red, then green — 0486229
- [x] 2.2 README, docs/02, docs/05, versions 0.1.6 — 0486229
- [x] 2.3 Gates green (typecheck, lint, test, build) — 0486229

---
change_id: db-process-glue-404
---

# Research: db process glue (issue #404)

## Current code

- `foundation/db/src/process.ts`: `createProcessDatabase(url, { schema, max })` keeps `opening` / `opened` in closure
  variables. A module re-evaluated by `next dev` creates a fresh closure: its `db` refuses queries although the shared
  pool (`shared.ts`, on `globalThis` under `Symbol.for`) is still open. There is no way to close every process database
  from a test's `afterEach` except `closeSharedDatabases()`, which leaves each `ProcessDatabase` believing it is open
  (`opened` set, pointing at a closed pool).
- `shared.ts` and `configured.ts` already use the `Symbol.for("@softure-ai/db/…")` on `globalThis` pattern; the new
  process registry follows it.
- App migrations: `AppMigrationHook = (handle) => Promise<void>` (`migrations/migrator.ts`). The README (§4, "App
  migrations") gives a `runDrizzle(handle, folder)` recipe choosing `drizzle-orm/node-postgres/migrator` or
  `drizzle-orm/pglite/migrator` by `handle.kind`; `tests/app-migrations.test.ts` copies it, with the fixture folder
  `tests/fixtures/app-drizzle/`. `drizzle-orm` is already a required peer.
- Raw SQL: `DatabaseHandle` exposes `pool` (pg) or `client` (PGlite); both have `query(text, values)` resolving to
  `{ rows }`. `tests/support/query.ts` has its own `queryRows` doing exactly this.
- esbuild `^0.28.2` is a root devDependency; `tests/bundle.test.ts` already bundles with it. `metafile.inputs[path]
  .imports[]` gives each input's resolved imports (`path`, `kind`, `external`), keyed relative to `absWorkingDir`.
  `packages: "external"` keeps node_modules out of the graph, so only the app's own files are walked.

## Options

- Item 4 as `handle.query`: changes `DatabaseHandle`, breaks `isDatabaseHandle` for handles built elsewhere. Rejected
  for free functions.
- Item 1 by static regex over imports instead of esbuild: misses path aliases and re-exports. esbuild resolves both.

## Risks

- esbuild loaders: an entry importing a CSS or asset file would fail the build. The guard passes `loader` defaults
  for common asset extensions as `empty` and lets the caller add `external` patterns.

# Plan: database-shared-handle

Input: `change.md`, `research.md` (framing skipped, reason in change.md). Complexity: medium (three phases).

## Goal

- `defineSoftureConfig({ database: { url, handle: () => appHandle } })` is accepted; `handle` must be a function
  (anything else is a config error). Every module adapter, the blog proxy and sitemap, the ops health route and
  every package command (`softure migrate`, `softure-blog publish`, `softure-mail campaign`, ops scripts) then
  query through that one handle. Without `handle`, behaviour is unchanged.
- `getConfiguredDatabase(config.database)` in `@softure-ai/db` is the one resolver: the app's handle (called once
  per process, validated, cached on `globalThis`) or `getSharedDatabase(url)`.
- `createPgliteHandle(client)` and `createPostgresHandle(pool)` are exported.
- `Database<TSchema>`, `PostgresDatabase<TSchema>`, `PgliteClientDatabase<TSchema>`, `Queryable<TSchema>` with a
  default that accepts a schema-typed app database.
- `@softure-ai/db`: `@electric-sql/pglite`, `pg`, `@types/pg` become optional peers (devDependencies in the
  workspace); the example app adds `pg`.
- `withSession` on PGlite restores only what the run changed.
- Docs: db README §2 (drivers), §3 (one handle per process: either `handle` or build on the shared handle, with a
  typed drizzle example), core README §3 (`database.handle`), docs/02 database line, docs/05 step 2; the example
  app's `lib/database.ts` uses the shared handle.

**Out of scope:** `foundation/db/src/migrations/adopt.ts` (#170); release of `db` and `core`; the ops
`getDatabase` option keeps working (it still wins over the config for the health route).

## Approach

The issue's second proposal as the mechanism, the first as documentation. The handle is a lazy function because
the config is evaluated at build time and imported by commands that never connect (#155): calling it only when a
module needs the database keeps both working.

## Key decisions

- **A function, not a value.** A value would force the app to open its client while the config module evaluates,
  including during `next build` and `--export-migrations`.
- **Typed through declaration merging.** Core declares `interface SoftureDatabaseHandleTypes {}` and types
  `handle` as `() => Handle | Promise<Handle>` where `Handle` is that interface's `handle` member, or `unknown`
  when db is not loaded. `@softure-ai/db` augments it with `DatabaseHandle`. db still validates the returned value
  (`kind`, `db`, `close`, and `pool` or `client`), so a plain-JS config fails with a message naming
  `createPgliteHandle`/`createPostgresHandle`.
- **`url` stays required.** It is what a config without `handle` opens and what the docs already show; making it
  optional would change `config.database.url`'s type at every call site for no gain.
- **Ops health route:** `getDatabase` option first; then the configured handle when `handle` is set or the URL is
  `pglite://` (the shared handle in the same process, never a second instance, so the "cannot be opened a second
  time" error goes); otherwise its small Postgres pool as today.
- **Commands own what they open.** `openCommandDatabase(database, options)` in db returns `{ handle, close }`:
  with `handle`, the configured handle and a close that closes and forgets it (a PGlite directory is only written
  back on close); without, `createDatabase(url, options)` and its close. Injected test openers keep precedence.
- **Restore, don't reset.** Snapshot `pg_settings WHERE source = 'session'` before the run; afterwards
  `set_config(name, old, false)` for changed values and `RESET name` for settings the run added.
- **Wide default type parameter** `Record<string, unknown>` (measured in research); modules keep writing
  `Database`/`Queryable` without arguments.

## Phase 1: db and core API (TDD)

- `foundation/core/src/config.ts`: `database: { url, handle? }`; schema `handle: z.custom<…>(isFunction).optional()`;
  freezing keeps the function; `SoftureDatabaseHandleTypes` exported from `index.ts`.
- `foundation/db/src/client.ts`: generic types, `createPostgresHandle(pool)` used by `createDatabase`,
  `createPgliteHandle` exported; `isDatabaseHandle(value)`.
- `foundation/db/src/configured.ts` (new): `getConfiguredDatabase`, `openCommandDatabase`; cache keyed by the
  handle function on `globalThis`; `closeSharedDatabases` also closes configured handles; module augmentation.
- `foundation/db/src/migrations/session.ts`: restore instead of `RESET ALL`.
- `foundation/db/package.json`: optional peers, devDependencies.
- Tests: `foundation/core/tests/config.test.ts` (handle accepted and kept; a non-function refused);
  `foundation/db/tests/configured.test.ts` (configured handle returned and called once; falls back to the shared
  URL handle; a non-handle return rejects with the message; `openCommandDatabase` closes and forgets; a failed
  handle call is not cached); `foundation/db/tests/session.test.ts` (PGlite keeps an app's `TimeZone` and
  `search_path` after `migrate`, and a migration's own `SET` is still undone); a type test file proving a
  schema-typed drizzle instance is accepted where `Queryable` is expected.

Done when: new tests seen red on the old code, then green; db and core typecheck.

## Phase 2: adapters and commands

- The eleven `getSharedDatabase(config.database.url)` call sites switch to `getConfiguredDatabase(config.database)`.
- Ops health route as decided; `modules/ops/src/options.ts` doc for `getDatabase`; ops scripts, blog and mailing
  commands, `softure migrate` through `openCommandDatabase`.
- Tests: blog and billing mocks of `getSharedDatabase` follow the rename; ops route test: `pglite://` without
  `getDatabase` now answers from the shared handle (was a thrown 500); one adapter test (feature-switches) proves
  the configured handle is the one queried; `softure migrate` with a configured PGlite handle migrates through it.

Done when: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` green.

## Phase 3: docs and example app

- db README §2/§3, core README §3, docs/02, docs/05 step 2, module READMEs that tell the app to share a handle
  (ops `getDatabase` text); example app `lib/database.ts` on `getSharedDatabase`, `pg` in its dependencies;
  CHANGELOG entries if the packages keep one.

Done when: gates green, the language gate passes, markdown links valid.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: db and core API

#### Automated
- [ ] 1.1 Tests seen red, then green
- [ ] 1.2 Config key, configured resolver, client exports, generic types, session restore, optional peers

### Phase 2: adapters and commands

#### Automated
- [ ] 2.1 Adapters, health route and commands use the configured handle
- [ ] 2.2 Gates green (typecheck, lint, test, build)

### Phase 3: docs and example app

#### Automated
- [ ] 3.1 READMEs, docs and example app updated
- [ ] 3.2 Gates green after docs

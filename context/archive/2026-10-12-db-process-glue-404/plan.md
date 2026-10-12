---
change_id: db-process-glue-404
status: archived
---

# Plan: db process glue (issue #404)

Input: change.md, research.md. Complexity: medium (four additive APIs, two test files, docs).

## Phase 1: process handle options, app drizzle migrations, raw query (TDD)

Files: `foundation/db/src/process.ts`, new `foundation/db/src/raw.ts`, new `foundation/db/src/migrations/drizzle.ts`,
`foundation/db/src/index.ts`; test `foundation/db/tests/process-glue-404.test.ts`.

1. Tests first, red on master:
   - two `createProcessDatabase(url, { globalKey: "app" })` calls (a re-evaluated module) share state: opening one makes
     the other's `db` query; without `globalKey` they stay separate.
   - `closeProcessDatabases()` closes every opened process database: `isOpen()` is false and `db` refuses queries.
   - `drizzleAppMigrations(folder)` as `app.before` creates the fixture's tables on both drivers; a `URL` folder works.
   - `queryDatabase(handle, "select $1::int as n", [7])` returns `[{ n: 7 }]` on both drivers;
     `openRawDatabase("pglite://")` queries and closes.
2. Implement: process state object (`opening`, `opened`) in a closure or on `globalThis` under
   `Symbol.for("@softure-ai/db/process:" + globalKey)`; every state registered in a `globalThis` set;
   `closeProcessDatabases()` closes them all. `drizzleAppMigrations(folder: string | URL): AppMigrationHook`.
   `queryDatabase<TRow>(handle, text, values?)`, `openRawDatabase(url, options?)` → `{ kind, query, close }`.

## Phase 2: entry-point guard (TDD)

Files: new `foundation/db/src/entry-guard.ts`, `foundation/db/src/testing.ts`, `foundation/db/package.json`
(optional peer `esbuild`); test `foundation/db/tests/entry-guard.test.ts` with fixture entries under
`tests/fixtures/entries/`.

1. Tests first: fixture `client.ts` (the app's db module), `server.ts` (imports it through `lib.ts`, calls `.open(`),
   `script-ok.ts` (calls `withDatabase(`), `script-bad.ts` (imports it, never opens), `pure.ts` (does not reach it).
   `findEntriesReachingDatabase` returns the three reaching entries with `opens` true/true/false; `pure.ts` is absent.
   `expectEntriesOpenDatabase` throws naming `script-bad.ts` only; passes with `opens` matching a custom pattern;
   a missing `clientModule` throws.
2. Implement with esbuild `build({ bundle, write: false, metafile, platform: "node", format: "esm",
   packages: "external" })`, walk `metafile.inputs` from each entry, test the entry source against `opens`.

## Phase 3: docs

`foundation/db/README.md` (§3 module-level db: `globalKey`, `closeProcessDatabases`, entry guard, raw query; §4 app
migrations use `drizzleAppMigrations`), `foundation/db/CHANGELOG.md` (`## Unreleased`).

## Progress

- [x] Phase 1: process handle options, app drizzle migrations, raw query (`184ec03`; the new test file failed on master, 11 tests green after)
- [x] Phase 2: entry-point guard (`5455585`; 6 tests, red before the module existed)
- [x] Phase 3: docs (README §1, §3, §4; CHANGELOG `Unreleased`)

---
change_id: db-driver-errors-process-database
status: archived
---

# Plan: driver-error helpers and a process database in @softure-ai/db (issue #313)

Input: change.md (research and framing skipped, reasons there). Complexity: small (two phases plus docs).

## Today (master `e13ae0c`)

- `findDriverError` walks `error` and up to two `cause`s for a string `code`; blog returns `{ code, constraint }`,
  privacy also `message`. Blog matches `23P01` (pillar exclusion) and `23505` on `articles_slug_key`; privacy matches
  class `23` and reports `constraint ?? message`.
- `getSharedDatabase(url, options)` keeps one handle promise per URL on `globalThis`; only `closeSharedDatabases()`
  closes them, all at once. The handle's drizzle instance is built without a schema.

## Decisions (auto)

1. `findDriverError(error): DriverError | undefined` with `{ code, constraint, message }` (privacy's shape, a superset
   of blog's); follows up to 5 `cause` links, not 3, so an app's own wrapper around drizzle's error still resolves.
2. `isConstraintViolation(error, { code, constraint? })`: exact SQLSTATE match; constraint optional (any when left
   out). No class matching: privacy keeps `findDriverError` for its class `23` check.
3. `createProcessDatabase(url | () => url, { schema?, max? })` returns `{ db, open, close, withDatabase, isOpen }`.
   - `open` resolves the URL, opens `getSharedDatabase(url)` once (concurrent and later calls share the promise; a
     failed open is forgotten).
   - `db` is a `Proxy` forwarding to the open drizzle instance (methods bound to it); a closed one throws
     "Database is not open: call open() or withDatabase() at the process entry before querying". `then` reads as
     undefined while closed, so `await db` does not throw.
   - With `schema`, the drizzle instance is rebuilt over the same pool or client with the schema, so `db.query` works.
   - `close` closes the shared handle for that URL (new `closeSharedDatabase(url)`, exported) and forgets it.
   - `withDatabase(main)` = open, `main(db)`, close in `finally`.
4. URL as a function: a script loads its environment after imports; a string is read the same way.

## Phase 1: helpers and process database in db (TDD)

Files: `foundation/db/src/driver-errors.ts`, `src/process.ts`, `src/shared.ts`, `src/index.ts`,
`tests/driver-errors.test.ts`, `tests/process.test.ts`, `tests/shared.test.ts`.

Tests first (fail on master: the exports do not exist): duplicate insert through drizzle on PGlite gives
`23505`/constraint/message; direct driver error; no code, non-error, numeric code → undefined; `isConstraintViolation`
true/false cases; process database refuses before open, is no thenable while closed, queries after open on the shared
handle, opens once, reads a URL function on open, closes (twice), `withDatabase` returns and closes on throw, schema
enables `db.query`, empty URL rejects and stays closed; `closeSharedDatabase` closes one URL only.

## Phase 2: blog and privacy use the export; docs and versions

Files: `modules/blog/src/db/publish-run.ts`, `modules/privacy/src/server/copy-account.ts`, README §1 and §3,
CHANGELOGs, versions (db 0.1.7; blog, privacy 0.1.11 in `package.json`, `module.json`, `src/index.ts`), their
`@softure-ai/db` range `^0.1.7`, `package-lock.json`.

Done when: the existing blog (slug race, pillar) and privacy (copy conflict) tests pass unchanged; gates green.

## Progress

- [x] Phase 1: helpers, process database, `closeSharedDatabase` (15 + 1 new tests)
- [x] Phase 2: blog and privacy on the export; README, CHANGELOGs, versions

Gates on the branch: `npm run typecheck`, `npm run lint` green; `vitest run foundation/db modules/blog modules/privacy
tests/repo` 1356 passed, 48 skipped (Postgres-only); `npm run build` and the full `npm test` run before the push.

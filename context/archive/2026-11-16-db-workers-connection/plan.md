# Plan: db-workers-connection (RP-2)

## Approach

Add a request scope to `@softure-ai/db` (AsyncLocalStorage), make `getConfiguredDatabase` honour it, expose the
Workers-safe surface as a new `@softure-ai/db/request` entry, declare it in `softure.workers`, and test the scope
on Node against PGlite-free fakes plus a real Postgres where the suite already has one. db 0.1.15.

## Phases

### Phase 1: request scope (TDD)
- `foundation/db/src/request.ts`: `withRequestDatabase({ url, waitUntil?, max? }, run)`, `getRequestDatabase()`
  (the scope's handle or `undefined`), `isWorkersRuntime()`; the handle opens lazily on first use in the scope, so a
  request that never queries opens nothing; `close` goes to `waitUntil` when given, else is awaited.
- `configured.ts`: inside a scope return the scope's handle; outside a scope on Workers throw
  `getConfiguredDatabase: no request database on Workers; wrap the fetch handler in withRequestDatabase(...)`.
- `pglite://` in a scope throws `PGlite is Node-only`.
- `getSharedDatabase` on Workers outside a scope throws the same message (covers `createProcessDatabase`).
- Done when: tests show one handle per scope, two concurrent scopes get two handles, the handle closes after `run`
  resolves and after it throws, `waitUntil` receives the close, no open without a query, and the Workers error.

### Phase 2: Workers-safe entry
- `foundation/db/src/request-entry.ts` (export `./request`): scope functions, `getConfiguredDatabase`,
  `createPostgresHandle`, handle types, `findDriverError`, `isConstraintViolation`. Root re-exports the new functions.
- Split `configured.ts` so `/request` does not reach `openCommandDatabase` if that pulls files (verify with the
  guard). `softure.workers: ["./request"]`.
- Done when: the guard passes on `./request` and fails when the entry imports `migrations/files.ts`.

### Phase 3: docs
- db README: "Running on Workers" (Hyperdrive binding, the worker entry wrapping the handler, migrations from CI).
- CHANGELOG, version bump, docs/07 matrix row.

## Progress

- [x] Phase 1: `request.ts`, scope in `getConfiguredDatabase` and `getSharedDatabase`; 8 tests, skipping the close turns 2 red
- [x] Phase 2: `@softure-ai/db/request` (`request-entry.ts`) listed in `softure.workers`; importing `migrations/files.ts` from it turns the guard red
- [x] Phase 3: README §3 "Running on Cloudflare Workers", CHANGELOG 0.1.15, docs/07 row

---
change_id: db-test-database-close-523
---

# Research: db-test-database-close-523

Sources: `foundation/db/src/testing.ts`, `foundation/db/src/client.ts`, `foundation/db/tests/testing.test.ts`,
`@electric-sql/pglite` 0.5.10 typings (`PGlite.waitReady`).

- `createTestDatabase` builds `new PGlite({ loadDataDir })` and wraps it with `createPgliteHandle`, which only
  imports drizzle and returns `close: () => client.close()`. Nothing awaits the client's initialization.
- PGlite starts initializing in its constructor; `waitReady: Promise<void>` resolves when it is done. A query awaits
  it internally, `close()` does not: closing a client still loading its data folder never resolves.
- Reproduced on master: `await (await createTestDatabase([])).close()` times out (8 s test timeout, 1 failed).
- Other PGlite handles go through the same function: `createDatabase("pglite://…")` (`client.ts:94`), the template
  build in `testing.ts`, and an app's own client passed to `createPgliteHandle`. All share the hazard.
- `waitReady` on an already ready client resolves at once; on a failed initialization it rejects, which surfaces the
  error at creation instead of at the first query.

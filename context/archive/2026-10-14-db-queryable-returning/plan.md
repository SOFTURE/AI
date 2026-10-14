---
change_id: db-queryable-returning
status: archived
---

# Plan: Queryable accepts returning({ ...columns }) (issue #475)

Input: change.md, research.md. Complexity: small (one type, one type test, docs).

## Phase 1: driver-neutral Queryable (TDD)

Files: `foundation/db/src/client.ts`, `foundation/db/src/index.ts`, `foundation/db/tests/types.test.ts`,
`foundation/db/README.md`, `foundation/db/CHANGELOG.md`.

1. Test first: in `types.test.ts`, a helper taking `Queryable` returns
   `db.delete(t).where(...).returning({ id: t.id })` typed `{ id: string }[]`, and the same for `update`; an
   `execute()` on a `Queryable` exposes `rows`. Fails with TS2554 before the change.
2. `client.ts`: `QueryableResult`, `QueryableResultHKT`, `Queryable = PgDatabase<QueryableResultHKT, TSchema>`;
   export the two new types from `index.ts`.
3. Docs: README `Queryable` bullet (driver-neutral, `returning({ … })`, `execute()` gives `rows`); CHANGELOG
   `## Unreleased`.
4. Gates: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.

## Progress

- [x] Phase 1: driver-neutral Queryable (`a76881c`; 3 type tests written first: both drivers and transactions
  assignable, `returning({ id })` on delete and update, `execute()` rows; the `returning` checks failed with TS2554
  before the change)

Gates on the branch: `npm run typecheck`, `npm run lint`, `npm run build` green; `npm test` 6904 passed, 155 skipped.

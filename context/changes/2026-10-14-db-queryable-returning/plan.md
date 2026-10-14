---
change_id: db-queryable-returning
status: active
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

- [ ] Phase 1: driver-neutral Queryable

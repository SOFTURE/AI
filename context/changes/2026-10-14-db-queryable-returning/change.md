---
change_id: db-queryable-returning
title: "db: Queryable accepts returning({ ...columns }) (issue #475)"
status: active
roadmap_item: null
issue: 475
branch: claude/project-thread-0jr1rv
created: 2026-10-14
updated: 2026-10-14
---

## Intent

Close [issue #475](https://github.com/SOFTURE/AI/issues/475) (`@softure-ai/db`): `Queryable` is a union of both
drivers' databases and transactions, and on that union `update(...).returning()` / `delete(...).returning()` only
type-check without arguments; `returning({ id: table.id })` fails with TS2554. A module that only needs the key of
the row it hit has to return the whole row (in an adopting app, an up-to-8 MiB `bytea` column).

## Context

Labels: none yet (`pkg: db`, `bug` fit). Releases are batched by the coordinator: the db CHANGELOG gets
`## Unreleased`, the version bump comes with the release.

## Constraints

- An app database typed with its own schema, and its transactions, still pass where a module takes `Queryable`
  without a cast (the existing `types.test.ts`).
- Every module in this repository keeps compiling unchanged, including the `execute()` callers that read `.rows`.

## Notes

- Framing: skipped. The issue names the cause, the reproduction and the proposed fix (drizzle's `PgDatabase` base).
- A reproduction of the TS2554 was run before these artifacts were written; no source change was committed before
  them.

## Decisions (auto)

- `Queryable` becomes drizzle's driver-neutral `PgDatabase<QueryableResultHKT, TSchema>` instead of a union.
  Chosen over a narrowing helper: modules keep taking `Queryable` and need no extra call.
- `QueryableResultHKT` types `execute()` results as `{ rows }`, the part node-postgres' `QueryResult` and PGlite's
  `Results` share. Drizzle's own `PgQueryResultHKT` would make every `execute()` result `unknown` (breaks ops,
  privacy and the db tests). Driver-specific fields (`rowCount`, `fields`) stay reachable on `Database` or the handle.

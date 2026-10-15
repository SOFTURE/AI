---
change_id: db-queryable-returning
---

# Research: Queryable and returning({ ...columns }) (issue #475)

## Current state (master 62fb006)

- `foundation/db/src/client.ts`: `Queryable<TSchema> = Database<TSchema> | Parameters<Parameters<Database<TSchema>["transaction"]>[0]>[0]`,
  i.e. `NodePgDatabase | PgliteDatabase | NodePgTransaction | PgliteTransaction`.
- `returning` on drizzle's delete/update builders is overloaded (no argument → full row; `fields` → selection).
  Calling a method on a union of builders resolves against the intersection of signatures, so only the shared
  zero-argument overload survives: TS2554 reproduced with a type test (`db.delete(t).where(...).returning({ id })`).
- Drizzle class tree: `NodePgDatabase` and `PgliteDatabase` extend `PgDatabase<THKT, TSchema>`; both transactions
  extend `PgTransaction<THKT, …>`, which extends `PgDatabase`. So one `PgDatabase` type covers all four.
- `PgDatabase<PgQueryResultHKT>` (the issue's workaround) makes `execute()` resolve to `unknown`. Callers reading
  `.rows` on a `Queryable`: `modules/ops`, `modules/privacy` (copy-account, fixtures), `foundation/db` tests.
  No caller reads `rowCount`, `affectedRows` or `fields`.
- 67 files reference `Queryable`; modules pass `ctx.db` (a `Queryable`) into helpers and `transaction()`.

## Approach

- `QueryableResult<TRow> { rows: TRow[] }` and `QueryableResultHKT extends PgQueryResultHKT` with
  `type: QueryableResult<this["row"]>`; `Queryable<TSchema> = PgDatabase<QueryableResultHKT, TSchema>`. Both drivers'
  HKTs produce a type with `rows: TRow[]`, so their databases and transactions are assignable.
- A spike with this shape: `npm run typecheck` green over the whole tree.

## Risks

- An adopting app that read `rowCount` from `execute()` on a `Queryable` gets a type error; it narrows to `Database`
  or the handle. Documented in the CHANGELOG.
- Transactions taken from a `Queryable` are now typed `PgTransaction<QueryableResultHKT, …>`, driver-neutral; same
  members a module uses.

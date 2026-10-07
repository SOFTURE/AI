# Implementation review: db-adoption-app-references

Reviewed: the diff of `foundation/db/src/migrations/{stubs,reference,adopt,migrator}.ts`,
`foundation/db/tests/reference-stubs.test.ts`, the db README, docs/02 §4 and docs/05 step 3, against plan.md.
Verdict: **approve** (no open blocking finding).

## Plan conformance

| Plan item | State |
|---|---|
| `readAppTables` / `createAppStubs` in `stubs.ts` | done as planned; names quoted by Postgres (`quote_ident`, `format('%I.%I')`) |
| `buildReferenceSchema({ …, appTables })`, skipped objects in the failure reason | done |
| `listOwnedSchemas(units)` used by both call sites | done |
| `adoptModule` builds the reference inside the lock after the journal checks | done |
| README, docs/02 §4, docs/05 step 3 | done; the README limitation about app tables is replaced by the narrower one (domains, extension types, views, functions) |
| Tests seen red first | yes: all 12 cases (both drivers) failed on master, 11 with `relation "public.app_users" does not exist` / `db.adopt_reference_failed`, the mismatch case with that problem instead of `db.schema_mismatch` |

## Findings

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | The first run of the unique-index stub copied nothing: a foreign key records the index it references in `pg_constraint.conindid`, so "no constraint uses this index" excluded every index some FK pointed at, exactly the ones that matter. Caught by the `orders` test (`there is no unique constraint matching given keys`). | Fixed during implementation: only key constraints (`p`, `u`, `x`) count; a comment states why. |
| 2 | Suggestion | `drizzle` is listed twice: in `RESERVED_SCHEMAS` (`migrator.ts`) and as `APP_MIGRATOR_SCHEMA` (`reference.ts`). | Kept: `reference.ts` cannot import from `migrator.ts` (it is imported by it); the two lists serve different rules and each has its comment. |
| 3 | Suggestion | Stubs run before every module file, so an app column whose type is an enum owned by a module schema (excluded from copying, created later by that module's files) is skipped. A foreign key to such a column would fail, with the skipped column named. | Kept as a limit: no module on master exports a type an app table uses; the failure names the column. |
| 4 | Suggestion | `adoptModule` now holds the advisory lock while the scratch PGlite is built. | Kept (plan review #4): `migrate`'s baseline path already does the same. |

## Gates

`npm run typecheck`, `npm run lint`, `npm test` (with `SOFTURE_TEST_POSTGRES_URL`, both drivers) and `npm run build`:
see the Progress line in plan.md.

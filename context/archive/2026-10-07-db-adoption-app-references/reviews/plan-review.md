# Plan review: db-adoption-app-references

Reviewed: plan.md against change.md, research.md, `src/migrations/{reference,adopt,migrator,introspect}.ts`, the
`linked` fixture and the existing adopt / baseline tests. Verdict: **approve after fixes** (all applied below).

| # | Severity | Finding | Evidence | Decision |
|---|---|---|---|---|
| 1 | Warning | The "exclusion" key decision mixed a rejected constant with the chosen helper, so the contract between the call sites and `readAppTables` was unclear. | plan.md, Key decisions | Fixed: one helper `listOwnedSchemas(units)`, both call sites use it. |
| 2 | Warning | Generated DDL from catalog names must not concatenate raw identifiers (app tables can have mixed-case or quoted names). | SOFTURE conventions, Data | Fixed: names come back from the catalog already quoted (`quote_ident`, `format('%I.%I')`). |
| 3 | Warning | `--adopt --plan` runs no `before` hook (`cli/run.ts` runs it only without `--plan`), so a dry run on a database without the app tables still fails the reference. The plan did not say what the user sees. | `cli/run.ts:133-137` | Fixed: documented as a key decision and in the README; behaviour is correct (the dry run reads what is there). |
| 4 | Suggestion | Moving `buildReferenceSchema` inside the lock in `adoptModule` lengthens the time the advisory lock is held by the PGlite build. | `adopt.ts` | Kept: `migrate`'s baseline path already builds it under the lock; adoption is a one-off command. |
| 5 | Suggestion | A key column of an extension type (e.g. `citext`) is skipped, so an FK to it still fails. | research §3 | Kept as a documented limit; the failure reason names the skipped column, which a test pins. |
| 6 | Suggestion | Tables of a schema that belongs to a module the app has not enabled are stubbed too. | research §3 | Kept: they never appear in the comparison, which describes the target schema only. |

Lessons checked: test seen red before green (plan "Done when"); driver-parametrised tests (both PGlite and Postgres),
as the existing migrator tests.

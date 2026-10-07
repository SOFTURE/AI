# Plan review: db-adoption-baseline

Reviewed: plan.md against change.md, research.md, issue #152 and the code on master (`adopt.ts`, `migrator.ts`,
`cli/run.ts`, `testing.ts`). Verdict: **approve with fixes** (applied to plan.md where marked).

| # | Severity | Finding | Decision |
|---|---|---|---|
| F1 | Warning | `planMigrations` "ignores `app`" today; with a baseline it must read `app.baseline` but still run no hook, so it cannot know whether `before` will populate the schema. | Accepted as planned: `baseline` in the plan means "may adopt"; the CLI marker says "adopted if its schema exists". |
| F2 | Warning | The reference build runs the target's dependencies on a scratch PGlite **without** the app hooks. A module (or dependency) whose SQL references an app table in `public` cannot build its reference, so neither `--adopt` nor a baseline can adopt it (`db.adopt_reference_failed`). Pre-existing for `--adopt`; the baseline makes it reachable from plain migrate. Running `before` on the scratch would recreate the moved tables and collide with the module files. | Out of scope for #152 (no module on master references an app table in its own files); documented in the README limits and filed as #170. |
| F3 | Warning | `AppMigrationPhase = keyof AppMigrations` would include `baseline` once the key is added, and `runAppMigrations(handle, app, "baseline")` would type-check. | Fixed in plan: the literal `"before" \| "after"`. |
| F4 | Suggestion | A mismatch inside `migrate` must not leave a half-written adoption: recording 1..N and applying N+1 are separate transactions. | Plan already records 1..N in one transaction, then applies each later file in its own; a failure after the adoption leaves a consistent ledger (1..N adopted), same as a failing file today. |
| F5 | Suggestion | The `adoptModule` "refuses a dependent module while its dependency is pending" test changes meaning. | Plan replaces it with the dependency-applied-first and the dependency-fails cases. |
| F6 | Suggestion | `createTestDatabase`'s cache key must include the baseline or two baselines share a template. | In plan (Phase 1, `testing.ts`). |

Checked and fine: the out-of-order rule makes prefix-only adoption the correct contract (research §3); the auth case
(0001 adopted, 0002–0004 migrated) fits `through: 1`; no change to `foundation/core` (owned by #154); version stays at
the unreleased 0.1.6.

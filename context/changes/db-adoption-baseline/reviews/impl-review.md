# Implementation review: db-adoption-baseline

Reviewed: commits on `claude/project-thread-f8j2qr` against plan.md, change.md and issue #152. Verdict: **approve**
(one finding fixed, one filed as #170).

## Against the issue

| Issue point | Delivered | Proof |
|---|---|---|
| 1. Fresh databases after an upgrade | `app.baseline`: `migrate` adopts files 1..N where the schema holds objects and the ledger has never seen the module, then applies N+1..; empty schema migrates normally | `tests/baseline.test.ts` (fresh DB, module shipped 0003, shorter baseline, empty schema, mismatch), `tests/testing.test.ts` (test template), `tests/cli.test.ts` (plain migrate prints `adopted …`) |
| 2. Adopting a module whose dependency is new | `migrate` works unit by unit in dependency order, so a baseline module's new dependency is migrated first in the same run; `adoptModule` / `--adopt` apply the dependencies' pending files first (dry run lists them) | `baseline.test.ts` "applies a new dependency before adopting", `adopt.test.ts` "applies the pending migrations of a new dependency first", `cli.test.ts` `--adopt … --through 1` with `extras` |
| 3. All-or-nothing over files | `adoptModule({ through })` / `--through <n>` adopt a prefix; the rest is migrated | `adopt.test.ts` "adopts the files up to `through`", out-of-range cases |
| docs/05 step 3 | baseline, `--through`, dependency order | docs/05, docs/02 §4, db README §4/§5/§12 |

Not added, with reason (research §3): `--adopt-if-new` (a plain migrate with a baseline is that idempotent command)
and non-prefix adoption (the ledger's out-of-order rule refuses it; auth's case fits `through: 1`).

## Findings

| # | Severity | Finding | Decision |
|---|---|---|---|
| R1 | Warning | First draft of `adoptModule` applied the dependencies' files before comparing the target schema, so a mismatch left dependency files applied. | Fixed before commit: the comparison runs first; nothing is written on a mismatch. |
| R2 | Warning | The reference is built without the app's hooks: a module whose files reference an app table in `public` cannot be adopted, by `--adopt` or by a baseline (`db.adopt_reference_failed`). Pre-existing for `--adopt`. | Out of scope; documented in README §12 and filed as #170. |
| R3 | Suggestion | A failure in a baseline module stops the run like a failing file: modules before it stay migrated, `after` does not run. | Intended (plan key decision), covered by the mismatch test and README §4. |
| R4 | Suggestion | `migrator.ts` grew; the shared primitives moved to `apply.ts` and the reference build to `reference.ts`, avoiding an import cycle between `migrator.ts` and `adopt.ts`. | Kept. `migrator.ts` re-exports the moved names, so `export.ts` / `exported.ts` imports did not change. |

## Checks

- Tests seen red first (24 failing before the code), then green on PGlite and Postgres 16
  (`SOFTURE_TEST_POSTGRES_URL`): `foundation/db` 217 passed.
- `npm run typecheck`, `npm run lint` green; full `npm test` and `npm run build` green (see PR).
- No change to `foundation/core` (#154's), version stays at the unreleased 0.1.6, no release.

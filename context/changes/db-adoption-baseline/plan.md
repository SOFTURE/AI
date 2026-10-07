# Plan: db-adoption-baseline

Input: change.md, research.md (framing skipped, reason in change.md). Complexity: medium (two phases).

## Goal

- `AppMigrations.baseline?: Readonly<Record<string, number>>` (module id → last file the app's own history creates).
  `AppMigrationPhase` becomes the literal `"before" | "after"`.
- `migrate` works unit by unit in dependency order. For a baseline module with no ledger rows: empty schema →
  apply every file; otherwise compare the live schema with the reference of files 1..N, record 1..N as `adopted`
  (one transaction), apply N+1.. normally. The report gains `adopted: MigrationStep[]`; `onAdopted?(step)` callback.
- Baseline checks before anything runs: a module that is not enabled → `db.adopt_unknown_module`; no schema →
  `db.adopt_no_schema`; N not an integer in 1..files → `db.adopt_through_out_of_range { module, through, files }`.
- `planMigrations(handle, { modules, app })`: same checks; `MigrationPlan.baseline` lists the pending steps a run may
  adopt instead of applying (files 1..N of a baseline module with no ledger rows).
- `adoptModule(handle, { …, through? })`: adopts 1..through (default: every file), compared with the reference of the
  same files; applies the pending files of the target's dependencies first (report `dependencies`), dry run lists
  them. A failing dependency file → `[db.migration_failed, db.adopt_dependency_pending]` (message: adopt it first).
  `checkAdoptable` keeps `db.adopt_already_applied`.
- CLI: `--through <n>` (only with `--adopt`, positive integer, else usage error); `--adopt` prints `applied …` for
  dependency files; migrate prints `adopted …`; `--plan` prints `pending … (adopted if its schema exists)` for
  baseline steps.
- `createTestDatabase`: the template key includes the baseline.
- README §4/§5, docs/02 §4, docs/05 step 3: the baseline recipe, `--through`, dependency-first adoption.

**Out of scope:** a config-level baseline / the `softure` bin (core config is #154's), non-prefix adoption (the ledger's
ordering rule, research §3), `--adopt-if-new` (a plain migrate with a baseline is that command), any release.

## Key decisions

- **The reference is built by one internal helper** `buildReference(modules, target, through, migrationsDir)` shared by
  `adoptModule` and `migrate`: scratch PGlite, the target's dependencies fully, the target's files 1..through.
- **Lazy reference**: `migrate` builds it only when it actually adopts (schema populated), so a database already
  adopted needs no PGlite.
- **A mismatch stops the run** like a failing file: earlier units stay applied, nothing of this module is recorded,
  `after` does not run.
- **Shared adoption write**: `recordAdoption(session, unit, files)` in one transaction, used by both paths.

## Phase 1: baseline in migrate and plan, `through` and dependency-first adopt (TDD)

- `tests/baseline.test.ts` (both drivers): fixtures `notes` (2 files) and a copy with a third file; an `extras`
  module (copy folder) that `notes` depends on;
  - fresh DB, `before` builds the notes tables, baseline `{ notes: 2 }` → ok, ledger notes 1–2 `adopted`, data kept;
    second migrate: nothing, no adoption;
  - module ships 0003, baseline `{ notes: 2 }` → 1–2 adopted, 0003 applied;
  - `before` creates nothing → all files applied (method `applied`);
  - baseline larger than the history (`{ notes: 2 }`, history lacks the index) → `db.schema_mismatch`, no notes rows,
    `after` not run;
  - baseline module with a new dependency `extras` → extras applied, notes adopted, one run;
  - baseline errors: unknown module, out of range (0, 3, 1.5), module without schema → refused, nothing ran
    (`before` not called);
  - plan: `baseline` lists notes 1–2 on a fresh DB, empty after the run.
- `tests/adopt.test.ts`: `through: 1` adopts 0001 only (schema without the index), later migrate applies 0002;
  `through` out of range refused; dry-run report with a pending dependency lists it; adopting a dependent module
  whose dependency's tables exist → `[db.migration_failed, db.adopt_dependency_pending]` (replaces the old
  "refused" case); adopting with a new dependency applies it first.
- `tests/cli.test.ts`: `--through` parsed and passed; `--through` without `--adopt` and non-integer → exit 2; migrate
  with a baseline prints `adopted notes 0001_create_notes.sql`; `--plan` prints the baseline marker.
- `tests/testing.test.ts`: `createTestDatabase` with a baseline builds a fresh database whose ledger shows `adopted`.
- Code: `migrator.ts`, `adopt.ts`, `problems.ts`, `cli/run.ts`, `testing.ts`, `index.ts`.

Done when: new tests seen red first, then green; db tests green on PGlite and Postgres.

## Phase 2: docs

- db README §4 (baseline recipe in the app script, `--through`, plan marker, PGlite needed where a baseline adopts),
  §5 (adoption: through, dependencies first, baseline), API line; docs/02 §4; docs/05 step 3 (fresh databases).

Done when: `npm run typecheck|lint|test|build` green; repo tests (links) green.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: baseline in migrate and plan, `through` and dependency-first adopt

#### Automated
- [ ] 1.1 Baseline, through and dependency tests seen red, then green
- [ ] 1.2 migrate, planMigrations, adoptModule, CLI and createTestDatabase carry the baseline

### Phase 2: docs

#### Automated
- [ ] 2.1 README, docs/02, docs/05
- [ ] 2.2 Gates green (typecheck, lint, test, build)

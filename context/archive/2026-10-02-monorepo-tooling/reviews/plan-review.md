# Plan review: monorepo-tooling

Reviewed: plan.md @ 2026-10-02. Verdict: ready after fixes.

## Findings

### C1 [CRITICAL] Root package is CommonJS under NodeNext
**Where:** Phase 1, steps 2-3 (plan.md) · `package.json` (no `"type"` field)
**Problem:** the base config uses `module: NodeNext`. In a package without `"type": "module"`,
TypeScript treats `.ts` files as CommonJS, so `import.meta` (used by the ESLint config and the
repository tests to find the repo root) fails to typecheck and the phase 1 gate cannot go green.
**Decision:** Fix now — step 0 adds `"type": "module"` to the root `package.json`.

### W1 [WARNING] Typed lint cannot find template files
**Where:** Phase 4, step 3 (plan.md)
**Problem:** typescript-eslint's `projectService` uses the nearest `tsconfig.json` for each file.
A template `tsconfig.json` without `include` for `src/**` and `tests/**` makes every template file
"not found in the project", and `npm run lint` fails.
**Decision:** Fix now — step 3 states the template `tsconfig.json` includes `src/**` and `tests/**`.

### W2 [WARNING] Exclude patterns miss nested folders
**Where:** Phase 1, step 3 (plan.md)
**Problem:** `exclude: ["dist"]` only matches the root `dist`. After `npm run build`, root `tsc`
would also typecheck `templates/package/dist/**/*.js` through `allowJs`.
**Decision:** Fix now — excludes are `**/node_modules`, `**/dist`.

### S1 [SUGGESTION] Language gate edge cases
**Where:** Phase 2, step 1
**Problem:** empty and binary files are handled in step 2 but not tested.
**Decision:** Fix now — two cases added to the test list.

### S2 [SUGGESTION] Hook provocation needs a runnable clone
**Where:** Phase 5, step 5
**Problem:** a bare clone has no `node_modules`, so `npx lefthook` and `tsc` would not run there.
**Decision:** Fix now — the clone gets `node_modules` symlinked from the checkout and its own
`npx lefthook install`.

## Lenses with no findings

- Coverage: every Outcome bullet and every Baseline check maps to a Progress item; the compiled
  CSS part is assigned to FD-5 with a recorded reason (research Open questions).
- Slicing: each phase leaves typecheck, lint and test green.
- Verifiability: every criterion names a command or a provoked hook outcome.
- Data and migrations: none.
- Security: CI has `contents: read` only; no secrets are read or written.
- Scope: `docs/02-module-standard.md` (one build line) and `AGENTS.md` (one project section) sit
  outside the owned list but are owned by no other change; FD-8 later reconciles docs.
- Reuse: no SOFTURE module applies.
- Lessons: `lessons.md` is empty.
- Progress format: one `### Phase N:` per `## Phase N:` with identical titles, gates item last in
  each Automated group, Manual only in phase 5.

## Decisions (auto)

- C1, W1, W2 → Fix now (clear fixes, no conflict with change.md).
- S1, S2 → Fix now (cheap, inside files the plan already touches).

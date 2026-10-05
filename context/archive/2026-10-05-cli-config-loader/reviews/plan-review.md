# Plan review: cli-config-loader

Reviewed: plan.md @ 2026-10-05. Mode: quick (small, one phase). Verdict: ready after fixes.
Findings: 0 critical, 1 warning, 1 suggestion.
Grounding: 9/9 paths (the three `cli/command.ts`, their three `tests/cli.test.ts`,
`foundation/core/package.json`, `foundation/db/tests/bundle.test.ts`, `tests/repo/packages.test.ts`),
5/5 symbols (`takeConfigOption`, `findDefaultConfig`, `loadConfig`, `isConfigLike`, `SoftureConfig`),
3/3 commands (`workflow.json` gates).

## Lenses

| Lens | Result |
| --- | --- |
| Coverage and end state | PASS |
| Slicing | PASS (one phase leaves every bin working) |
| Verifiability | WARN (W1) |
| Data and migrations | PASS (no data) |
| Tests | PASS |
| Security | PASS (loads only the path the operator names or the default names in `cwd`, as today) |
| Lean | PASS |
| Fit | PASS (discriminated unions, options object for `loadAppConfig`) |
| Cost and defaults | PASS |
| Scope | PASS (BF-6's database opt-out stays out) |
| Reuse | PASS |
| Lessons | PASS (L-001: `tsc` build unchanged; the esbuild bundle is a test output) |
| Progress format | PASS |

## Findings

### W1 [WARNING] The container bundle is not named as a check
**Effort:** low. **Lens:** Verifiability. **Where:** Phase 1, Done when · `foundation/db/tests/bundle.test.ts:31-44`
**Problem:** db's bundle test bundles `@softure-ai/db/cli` with esbuild for a container image; after the
change that entry imports `@softure-ai/core/cli` (resolved through the `@softure-ai/source` condition). The
plan's criteria name only the cli tests, so a bundling regression would pass review unnoticed if the test
were skipped.
**Fix:** name the bundle test in step "Tests", the Done-when line and item 1.2.
**Decision:** Fix now (applied) - Tests, Done when and Progress 1.2 name `bundle.test.ts`.

### S1 [SUGGESTION] db's README describes the config lookup on its own
**Effort:** low. **Lens:** Fit. **Where:** Phase 1, step 5 · `foundation/db/README.md:55`
**Problem:** the README tells how `softure migrate` finds the config; after the change the lookup is shared,
and a reader of core's README would not learn which bins use it.
**Fix:** one sentence in db's README pointing at `@softure-ai/core/cli`.
**Decision:** Fix now (applied) - step 5 and the Files list name `foundation/db/README.md`.

## Triage summary
Fixed: W1, S1. Accepted: -. Deferred: -. Dismissed: -. Verdict after triage: ready.

## Decisions (auto)
- W1 → Fix now (clear one-line fix).
- S1 → Fix now (cheap, keeps the docs in step with the code).

# Plan review: core-contract

Reviewed: plan.md @ 2026-10-02. Verdict: ready after fixes.

## Findings

### W1 [WARNING] Phase 2 types depend on a phase 3 file
**Where:** Phase 2, step 4 (plan.md)
**Problem:** `ModuleContext.config` is a `SoftureConfig`, which phase 3 defines. Phase 2 would not
typecheck on its own, so its gate could not go green.
**Decision:** Fix now — phase 2 creates `src/config.ts` with the `SoftureConfig` interface only;
phase 3 adds `defineSoftureConfig` to it.

### S1 [SUGGESTION] Polish strings in tests
**Where:** Phase 1 tests (plural, dictionaries)
**Problem:** a Polish plural form spelled in a test fails the language gate.
**Decision:** Already covered — Critical details say tests read Polish copy from `coreMessages.pl`;
plural tests use neutral form labels (`"one"`, `"few"`, `"many"`, `"other"`).

## Lenses with no findings

- Coverage: every Outcome item maps to a step (config, module contract with all six named parts,
  Result, Clock, messages with overrides, locale/timezone, safeError, tests, README); the
  Baseline maps to 3.2.
- Slicing: each phase is green alone (after W1); phases are vertical (code + tests + exports).
- Verifiability: every criterion names a test file, a build output or a gate.
- Data and migrations: none.
- Security: `safeError` keeps SQL and parameters out of results; no secrets read or logged.
- Scope: `docs/02-module-standard.md` sits outside `foundation/core/` but no in-flight change owns
  it (FD-2 owns release files); two short notes only.
- Reuse: no SOFTURE module applies (this is the base package).
- Lessons: L-001 honoured (`tsc -p tsconfig.build.json`, no bundler).
- Progress format: one `### Phase N:` per `## Phase N:`, identical titles, gates item last.

## Decisions (auto)

- W1 → Fix now (clear fix, no scope change).
- S1 → No change (plan already covers it).

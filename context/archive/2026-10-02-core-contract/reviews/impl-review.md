# Implementation review: core-contract

Scope: full · Date: 2026-10-02 · Commits: e5b3c55..08b19ae · Gates: typecheck ✓ lint ✓ test ✓ (209 tests, 17 files) · build ✓

## Verdict
Ready. The three phases landed in their own commits and deliver every Outcome item of FD-3; each
phase's tests were seen red before the sources existed. The review found one gap (a module without
an options schema silently dropped option keys) and one formatting nit in docs/02; both are fixed in
08b19ae, the gap with a test seen red without the fix.

## Dimensions
| Dimension | Verdict | Findings |
|---|---|---|
| Plan adherence | PASS | route collision check dropped with a recorded reason (plan Decisions p3) |
| Scope | PASS | only `foundation/core/`, `package-lock.json` and two notes in `docs/02-module-standard.md` |
| Progress honesty | PASS | |
| Correctness | WARNING | F1 |
| Tests | PASS | |
| Data and migrations | PASS | none in this change |
| Security | PASS | `safeError` returns codes only; `errorLogLabel` logs class and SQLSTATE, never text |
| Architecture and patterns | PASS | F2 (suggestion) |
| Lessons | PASS | L-001: build is `tsc -p tsconfig.build.json` |

## Plan coverage
| Phase | Commit | Delivered | Notes |
|---|---|---|---|
| 1 Package shell and primitives | e5b3c55 | yes | 46 tests red before sources |
| 2 Module contract | 494c67d | yes | 63 tests red before sources |
| 3 App config, registry and docs | ac4724e | yes | 22 tests red before sources; dummy module baseline in `tests/dummy-module.test.ts` |

Files: planned and changed 27 · unplanned 1 (`foundation/core/tests/support.ts`, plan Decisions p3) · planned, not changed 0

## Findings

### F1 [WARNING] Options given to a module without an options schema were dropped silently
**Impact:** LOW · **Dimension:** Correctness · **Where:** foundation/core/src/module.ts (`parseOptions`)
**What:** a factory built without `options` ignored any option key the app passed.
**Why it matters:** a typo or an option meant for another module disappears without a trace, and
the app runs with defaults it did not ask for.
**Evidence:** `plain({ pageSize: 5 })` returned a module with `options: undefined` and no error.
**Fix:** each key becomes an issue `options.<key>: this module takes no options`; test added in
`tests/module.test.ts`, red without the fix (08b19ae).

### F2 [SUGGESTION] A long line in docs/02 §8
**Impact:** LOW · **Dimension:** Architecture and patterns · **Where:** docs/02-module-standard.md §8
**What:** the inserted registry note pushed the "Technical risk" sentence onto one 150-character line.
**Fix:** rewrapped (08b19ae).

## Checked without findings
- Types: a manifest's route names type the factory's `routes` overrides; module options infer from the zod schema (`z.input` in, `z.output` out); `SoftureModule<...>` is assignable to `AnySoftureModule`.
- Caret ranges on `0.x` and `0.0.x` follow npm (tests in `tests/version-range.test.ts`).
- Immutability: modules, routes, messages and manifests are deep-frozen; inputs are cloned, not shared.
- Client bundles: no `node:*` import anywhere in `src/`; `sideEffects: false`.
- Language gate: Polish copy only in `src/messages/pl.ts`; tests read Polish strings from dictionaries.

## Decisions (auto)
- F1 → Fix now (small, inside the change).
- F2 → Fix now (cosmetic, same commit).

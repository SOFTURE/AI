# Implementation review: ui-tokens-theme

Scope: full · Date: 2026-10-02 · Commits: 67827c9..2b7c553 · Gates: typecheck ✓ lint ✓ test ✓ (332 tests, 27 files) · build ✓ (styles.css 1.6 kB gzip)

## Verdict
Ready. The three phases landed in their own commits and deliver every Outcome item of FD-5: the
`--sft-*` contract with light and dark defaults, `SoftureThemeProvider` (object or `design.json`),
`ThemeScript` and `ThemeSwitch`, the Tailwind 4 bridge and the `styles.css` build in
`@layer softure` with the NFR-7 budget checked on every build. The review found two correctness gaps
in token value handling and one vacuous assertion; all three are fixed in 2b7c553.

## Dimensions
| Dimension | Verdict | Findings |
|---|---|---|
| Plan adherence | PASS | four small drifts, each recorded in plan Decisions (auto) |
| Scope | PASS | `foundation/ui/`, root devDependencies and lockfile, `.gitignore` (build scratch), docs/02 §5 |
| Progress honesty | PASS | 3.4 points at the screenshots in `reviews/` |
| Correctness | WARNING | F1, F2 (fixed) |
| Tests | WARNING | F3 (fixed) |
| Data and migrations | PASS | none |
| Security | PASS | token values validated before reaching `<style>`; cookie name validated before reaching the inline script |
| Architecture and patterns | PASS | package shape and release fields match `foundation/core`; Result and zod at the boundary as in core |
| Lessons | PASS | L-001: build is `tsc -p tsconfig.build.json && node scripts/build-css.mjs`; `dist/ui/theme-switch.js` keeps `"use client"` |

## Plan coverage
| Phase | Commit | Delivered | Notes |
|---|---|---|---|
| 1 Token contract and theme logic | 67827c9 | yes | 4 test files red before sources (no module) |
| 2 Provider, boot script component and theme switch | 07ca752 | yes | SSR tests; `"use client"` checked in `dist/` |
| 3 CSS pipeline, bridge and docs | a727dc1 | yes | Chromium screenshots for light, dark and override; system mode checked by emulated colour scheme |

Files: planned and changed 31 · unplanned 2 (`.gitignore` for the `.css-build-*` scratch folder, `reviews/theme-*.png` evidence) · planned, not changed 0

## Findings

### F1 [WARNING] An explicit `undefined` token threw instead of meaning "not set"
**Impact:** LOW · **Dimension:** Correctness · **Where:** foundation/ui/src/theme/theme-css.ts (`readDeclarations`)
**What:** `{ light: { "color-accent": undefined } }`, which `mergeThemes` or an object spread produce, threw "unsafe or empty value".
**Fix:** skip `undefined` entries. **Decision:** fix now — 2b7c553 (test "treats an explicit undefined as not set").

### F2 [WARNING] Token values could open a comment or escape the next character
**Impact:** LOW · **Dimension:** Correctness · **Where:** foundation/ui/src/theme/theme-css.ts (`UNSAFE_VALUE`)
**What:** `red /* x` swallowed the rest of the generated CSS (it cannot leave the `<style>` element, `<` was already refused); `\7d` relied on escape semantics.
**Fix:** refuse `/*` and `\`. **Decision:** fix now — 2b7c553 (two new cases in the unsafe-value table).

### F3 [WARNING] "Prefixed utilities only" passed vacuously when nothing matched
**Impact:** LOW · **Dimension:** Tests · **Where:** foundation/ui/tests/styles.test.ts
**Fix:** assert the selector list is non-empty first. **Decision:** fix now — 2b7c553.

## Mutation checks
- `UNSAFE_VALUE` weakened to `/;/`: 5 tests red, restored.
- `LAYER_ORDER` with `softure` last: the styles test went red, restored.

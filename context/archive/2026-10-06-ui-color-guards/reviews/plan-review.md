# Plan review: ui-color-guards

Date: 2026-10-06 · Verdict: approved with three fixes applied

Checked against change.md, research.md, FIRE's `color-vision.ts` and `theme-contrast.test.ts`,
`foundation/ui/{package.json,tsconfig.build.json,src/index.ts,tests/architecture.test.ts}`,
`tests/repo/packages.test.ts` (export order) and the lessons on unseen-green tests and oracles of another kind.

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Warning | The CIEDE2000 reference values were to be typed from memory of Sharma et al.'s table; a misremembered digit would make the oracle wrong in the same way as a buggy implementation could be. | Fixed: each reference value is confirmed with `colour-science` before it goes into the test (done during review: pairs 2.0425, 2.3669, 27.1492, 1.2644, 0.9533, 2.0373). |
| 2 | Warning | `blendColors` had no contract for `alpha` outside 0–1, which would silently produce out-of-gamut channels clamped to a plausible colour. | Fixed: an alpha outside 0–1 throws a `TypeError`, tested in 1.1. |
| 3 | Suggestion | Nothing stops a later edit from re-exporting `testing` from the root entry, which would ship the helpers in every app bundle. | Fixed: a test in phase 2 asserts the root entry does not re-export it. |
| 4 | Suggestion | The default `minDistance` (10 ΔE00) is derived, not measured on a palette. | Accepted as is: CH-4 measures its palette and may pass its own threshold; the default is documented with its derivation (research §3). |

No missing phase. Every criterion is checkable in the container (Vitest, the workspace build). The build already
compiles all of `src/**`, so `dist/testing/` needs no tsconfig change; `packages.test.ts` enforces the export order the
plan uses. No migration; the version bump is a patch within every dependent's `^0.1.0` range.

# Implementation review: charts-release

Reviewed 2026-10-06 against plan.md (phase 1) and the diff on `claude/ch-5-release-bh8ocu`. Verdict: **approve**;
one finding fixed before the commit, none open.

## Against the plan

| Plan item | Evidence |
| --- | --- |
| charts no longer private | `foundation/charts/package.json` without `private`; `node scripts/release/plan-tags.mjs "ui charts"` prints `ui@0.1.6` and `charts@0.1.0` |
| both tags pack clean | `npm run release:pack -- --tag charts@0.1.0` and `--tag ui@0.1.6`: `ok`; the charts tarball holds `LICENSE`, `README.md`, `dist/`, `src/` (no tests), `styles.css`, `dist/testing/` |
| tarballs work outside the repo | an empty project with the two tarballs, `@softure-ai/core` 0.1.5 from npm and React 19: `valueTicks` matches the README, `checkSeriesPalette()` returns `[]`, `LineChart` renders on the server (2307 characters, `sft-chart` classes) |
| README install and adoption guide | `foundation/charts/README.md`, "Installation" and "Adopting in FIRE_TRACKER" |
| roadmap and owner steps | CH-5 row and block both `done_code (…)`, four owner steps under "Owner decisions and checks" |
| gap CF-1 | `roadmaps/roadmap-charts-followups.md`, its backlog entry and README row, the row in `roadmaps/README.md` |

## Findings

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Warning | The guide's claim that `valueTicks(peakCents, target, { minStep: 100 })` reproduces FIRE's `valueTicks(peakCents, target)` was an inference (steps in zloty vs. unit-free steps). | Verified: a throwaway test ran both on 8 peaks × 4 targets (1 cent to 10 million zloty), all equal; the test was not kept, since it imports FIRE_TRACKER. |
| 2 | Suggestion | The smoke render with `locale: "en-US"` threw in `getChartsCopy` (no dictionary for that key). | Not a defect: `locale` is core's `Locale` (`en` or `pl`), so TypeScript rejects `en-US`; `formatDateTick` takes any BCP 47 tag through its own option. No change. |
| 3 | Suggestion | The language gate caught the Polish spelling of zloty in the README and in this review. | Fixed: "zloty". |
| 4 | Critical | `tests/repo/release-tags.test.ts` pins the number of public packages at 18; a public charts makes it 19, and `npm test` was red on it. | Fixed: the test expects 19 (seen red at 18, green at 19). |

## Not done here (owner)

The publish itself (Progress 1.4): `NPM_TOKEN`, `auto-release` with `ui charts`, the trusted publisher, deleting the
token. Irreversible, and on the owner's word only.

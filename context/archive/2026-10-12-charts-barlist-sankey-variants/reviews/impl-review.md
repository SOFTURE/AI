# Implementation review: charts-barlist-sankey-variants

Scope: full · Date: 2026-10-12 · Commits: 1ad7777..14fd05a · Gates: typecheck ✓ lint ✓ build ✓ test ✓ (6336 passed,
153 skipped; charts 202)

## Verdict

Ready. Every ask of #378 is delivered behind an opt-in option, the #321 oracles pass unchanged, and a browser render
of each variant (inline and stacked bar lists with missing and described rows; Sankey with leaders, fixed aspect and
no labels) matched the intent.

## Dimensions

| Dimension | Verdict | Findings |
| --- | --- | --- |
| Correctness | PASS | - |
| Backwards compatibility | PASS | - |
| Accessibility | PASS | W2 of the plan review handled in the README |
| Styling and tokens | PASS | S1 |
| Tests | PASS | - |
| Docs | PASS | - |

## Plan coverage

| Phase | Commit | Delivered | Notes |
| --- | --- | --- | --- |
| 1 | 1ad7777 | yes | description pinned to grid rows 2 (inline) and 3 (stacked) so auto-placement keeps label, track and value on row 1 |
| 2 | 6a47bb7 | yes | the label placement type is `SankeyLabelPlacement` (a `SankeyLabels` component already exists in the file) |
| 3 | 14fd05a | yes | - |

Files: planned and changed 9 · unplanned 1 (`src/index.ts`, new type exports) · planned, not changed 0.

## Findings

### S1 [SUGGESTION] Leader lines meet the label text without a gap
**Impact:** LOW · **Dimension:** Styling and tokens · **Where:** `foundation/charts/styles.css` (`.sft-chart-sankey-leaders`)
**What:** the strip starts at the label column's edge, so a line touches right-aligned text.
**Why it matters:** cosmetic; the column gap (`--sft-space-1`) separates them in the render.
**Fix:** none needed; an app can widen the gap on `.sft-chart-sankey-leaders`.
**Decision:** dismiss: the render reads cleanly.

## Progress audit

All three phases ticked with their SHAs; `change.md` status `implemented` → `impl_reviewed`.

## Triage summary

Fixed: -. Accepted: -. Deferred: -. Dismissed: S1.

## Lessons proposed

None.

## Decisions (auto)

- S1 dismissed (above).

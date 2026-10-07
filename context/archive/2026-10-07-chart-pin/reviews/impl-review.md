# Implementation review: chart-pin

Reviewed: commit c433732 against `plan.md` (Phase 1), `change.md` and `reviews/plan-review.md`. Mode: autonomous.

Verdict: **approve**. No blocking finding; one suggestion recorded, nothing to fix.

## Plan conformance

| Plan item | Where | State |
| --- | --- | --- |
| `ChartPin({ xPercent, yPercent, line?, slot? })`, HTML, `aria-hidden` | `foundation/charts/src/svg/pin.tsx` | done |
| Column at `left: x%`, line `height: y%` from the bottom, dot `bottom: y%` | same; markup asserted exactly in `tests/primitives.test.tsx` § pins | done |
| Dash lengths in `--sft-chart-dash` / `--sft-chart-dash-gap` on the two readers (plan-review F1) | `styles.css` | done |
| Ring `--sft-chart-axis`, fill `--sft-chart-flag` or the series slot | `styles.css` | done |
| Export, README (primitives row, Pins section, FIRE mapping), 0.1.1 + lockfile | `src/index.ts`, `README.md`, `package.json`, `package-lock.json` | done |

One addition outside the plan's file list: `tests/architecture.test.ts` registers the two dash properties in
`LOCAL_PROPERTIES`. The guard (styles.css reads only ui tokens) flagged them as unknown, which is its job; they are
local aliases of lengths, like `--sft-chart-axis-width`, not colours or new tokens.

## Verification

- Red first: the five pin tests failed with "Element type is invalid … got: undefined" before the export existed;
  green after (charts suite 119/119).
- Gates: `npm run typecheck`, `npm run lint`, `npm run build` green (exit 0); `npm test` runs in `pre-push`.
- Browser (Chromium, server-rendered page with ui's and charts' styles, a 900 × 256 px plot stretched from the
  1000 × 400 viewBox, light and dark): every dot measured 10 × 10 px (round), the lines 1 px wide ending at the plot's
  bottom (330 px) and under their dots; fills `--sft-chart-flag` and slot 3 purple, rings the axis grey of each
  scheme.
- Plan-review F2: the dashed `GuideLine` was screenshotted on the same page with master's `styles.css` and with the
  branch's: the 20 × 260 px crop around it is byte-identical, so `4px 3px` draws exactly what `4 3` drew.

## Findings

### S1 (Suggestion, no change): a slot outside 1–6 gives a transparent dot

`slot={7}` renders `sft-chart-series-7`, which no rule defines, so the fill reads an unset `--sft-chart-series`.
`SeriesLine`, `LegendSwatch` and the cursor share this contract: the slot comes from `seriesSlot(index)`, which wraps.
The prop's comment names `seriesSlot`; adding a wrap only in the pin would make it the one primitive that differs.

## Correctness, security, patterns

- Pure render, no state, no user input beyond numbers already rounded by `percent`; nothing to sanitise.
- No raw colour or size: the architecture guard passes; the dot and ring sizes are the cursor dot's.
- English only; the language gate passed in `pre-commit` and `commit-msg`.

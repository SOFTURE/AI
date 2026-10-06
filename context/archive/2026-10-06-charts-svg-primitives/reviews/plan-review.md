# Plan review: charts-svg-primitives

Date: 2026-10-06 · Verdict: approved with fixes applied

Checked against change.md, research.md, FIRE_TRACKER `src/components/chart/*`, `capital-chart-readout.tsx` and
`chart-primitives.test.tsx`, CH-1's `foundation/charts/src/scale/`, `foundation/ui/src/theme/` with its tests,
`modules/blog/styles.css` (the plain-CSS precedent), the example app's packing (`install-links`) and the lessons
cited in FIRE's code (L-031, WY-2, RD-5 F1, RD-12 F3).

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Warning | Series with different x values have no defined table row or cursor stop; a union would invent "no value" cells FIRE never needed. | Fixed: "Series share their x values" in Key decisions, a `TypeError` otherwise, and a test case. |
| 2 | Warning | No defined result for a chart without points: the scales get a zero-width domain, the cursor an empty list. | Fixed: frame, empty table body, inert keys; a test case in Phase 2. |
| 3 | Warning | A cursor dot ringed in the surface colour disappears when the series colour is close to the surface (FIRE RD-9: lime on white, 1.2:1). | Fixed: ring in `--sft-chart-axis` (≥ 4.5:1 in both themes). |
| 4 | Warning | `styles.test.ts` asserts that every token but `duration-` reaches the Tailwind bridge; a `chart-` family fails it. | Already in Phase 1: the exclusion is explicit, with the reason. |
| 5 | Suggestion | A polite status updated on every pointer move is chatty for a screen reader user who also moves a mouse. | Accepted: it announces only on a change of point, which is what the user asked for by moving; keyboard users get one announcement per key. |
| 6 | Suggestion | CH-3 may bump `@softure-ai/ui` too. | Accepted: one unreleased patch bump; the second merge keeps `0.1.6`. |
| 7 | Suggestion | Polish copy in `src/messages/pl.ts` must stay inside the language gate's exemption. | Checked: message dictionaries are exempt (ui and blog ship `pl.ts`). |

No migration. Copy goes through dictionaries. `@softure-ai/ui` changes and gets a patch bump; charts stays private.
Every criterion is checkable in the container except the e2e, which also runs in the e2e workflow on the pull request.

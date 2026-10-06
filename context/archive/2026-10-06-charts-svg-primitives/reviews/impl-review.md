# Implementation review: charts-svg-primitives

Date: 2026-10-06 · Verdict: approved after fixes (applied in the review commit)

Checked: the diff `f33d26a..HEAD` against plan.md and change.md, FIRE_TRACKER's `src/components/chart/*` and
`capital-chart-readout.tsx`, the gates, the chart e2e run locally against the built example app
(`next build`, Playwright on `/opt/pw-browsers/chromium`), and screenshots of `/chart` in light and dark at
1100 px and in light at 390 px with the cursor active.

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Warning | The value axis column (4 rem) clipped currency labels ("PLN 10,000") on the left edge of the figure (screenshot). | Fixed in phase 3: 5 rem by default, overridable as `--sft-chart-axis-width` on `.sft-chart` (README). |
| 2 | Warning | A single point (or a span with no calendar boundary) gave `dateTicks` `null` and the time axis no label at all. | Fixed: the first date is labelled as a day; test "labels the only date of a single point". |
| 3 | Warning | A flag outside the series' dates was drawn off the plot (a chip at `left: 130%`). | Fixed: flags outside `[start, end]` are left out; same test. |
| 4 | Suggestion | The readout's parts are spans in a flex row; without text between them a screen reader would read "Jan 2026Savings1,000". | Already handled: whitespace text nodes between the parts (invisible in a flex row); the cursor test asserts the spaced text. |
| 5 | Suggestion | Three series colours: a fourth series repeats the first. | Accepted: CH-4 owns the palette and its size; `dashed` tells series apart meanwhile (README). |
| 6 | Suggestion | Values below zero are drawn under the baseline. | Accepted as a documented limitation (the y domain starts at 0, as in FIRE and CH-1). |

Plan drift: none beyond the fixes above. Progress is honest: every ticked item has its commit and the e2e was
seen green locally (4 tests) before the tick. The cursor tests were seen red (9 failing) before the component
existed; the ported thinning test was seen red with the count from the bottom. No migration, no secret, no
route that needs authorization (`/chart` is a public demo page with fixed data).

Gaps queued: none.

# Plan review: chart-pin

Reviewed: `plan.md` (one phase) against `change.md`, the roadmap item CF-1, FIRE's `ChartPin` and the package's
`styles.css`, `cursor/chart-cursor.tsx`, `svg/lines.tsx` and `svg/flag.tsx`. Mode: autonomous (owner sets the goal,
the thread decides).

Verdict: **ready after the fixes below** (all applied to `plan.md`).

## Findings

### F1 (Warning, applied): the shared dash properties need a scope that reaches every pin

**Evidence:** the plan moves the guide's dash lengths into `--sft-chart-dash` / `--sft-chart-dash-gap` but does not
say where they are defined. Defined on `.sft-chart` (where `--sft-chart-axis-width` lives), a pin in an app's own
`ChartPlot` outside a `.sft-chart` figure would get an invalid gradient and draw nothing: no error, an empty column.

**Fix:** define both properties in one rule on `.sft-chart-guide-dashed, .sft-chart-pin-line` (the two readers), so
the pattern stays in one place and needs no ancestor. Plan § Key decisions amended.

### F2 (Warning, applied): `stroke-dasharray` with `px` lengths must be shown to match the old unitless one

**Evidence:** today `.sft-chart-guide-dashed` is `stroke-dasharray: 4 3` (unitless). With `vector-effect:
non-scaling-stroke` the dash is measured in screen pixels, so `4px 3px` should be identical, but no test can see a
dash (markup tests read classes). A wrong guess changes every flag's guide on every chart.

**Fix:** the manual check 1.4 also compares a `GuideLine` before and after (a screenshot of the same plot on master
and on the branch). Added to Phase 1's done-when.

### F3 (Suggestion, applied): out-of-range positions

**Evidence:** FIRE clamps nothing; a pin at `yPercent` 120 draws above the plot. The flag behaves the same.

**Fix:** no clamping (same contract as `ChartFlag` and the cursor: positions come from the same scales as the
drawing); the README states the pin takes percentages from `toPercent`.

### Checked, no finding

- **Dot in HTML** answers the roadmap's unknown with the package's own precedent (`sft-chart-cursor-dot`).
- **Ring contrast:** `--sft-chart-axis` is the axis label colour, which `@softure-ai/ui`'s contrast guard holds at
  text level on the backgrounds, so the ring keeps 3:1 non-text in both themes; FIRE's RD-9 is the reason not to ring
  in the background colour.
- **Scope:** no `LineChart` change, no ui token; the bump follows the roadmap release order.
- **Lessons:** none in `context/foundation/lessons.md` touch overlay primitives; the repo tests (links, package
  shape) run in `npm test`.

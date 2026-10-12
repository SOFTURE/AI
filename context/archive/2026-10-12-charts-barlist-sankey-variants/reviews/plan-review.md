# Plan review: charts-barlist-sankey-variants

Reviewed: plan.md @ 2026-10-12. Mode: quick. Verdict: ready after fixes.
Findings: 0 critical, 3 warning, 1 suggestion.
Grounding: 9/9 paths, 6/6 symbols (`getBarListRows`, `renderBarListHtml`, `layoutSankey`, `spreadLabels`,
`seriesColourClass`, `LOCAL_PROPERTIES`), 1/1 commands.

## Lenses

| Lens | Result |
| --- | --- |
| Coverage and end state | PASS: all seven asks of #378 map to D1–D7 (Sankey 4 by its "fixed aspect ratio" branch) |
| Backwards compatibility | PASS: every option opt-in; #321 oracles pinned |
| Data and migrations | N/A |
| Accessibility | WARN (W2) |
| Styling and tokens | WARN (W1) |
| Testability | PASS |

## Findings

### W1 [WARNING] A leader strip as a stretched replaced element may not follow the row height
**Effort:** low. **Lens:** Styling and tokens. **Where:** Phase 2, D6/D7.
**Problem:** an `<svg>` grid item with a viewBox has an intrinsic ratio; with `height: auto` under `aspect: "fixed"` it
would size from its width (1 : 400), not from the plot's row.
**Fix:** wrap each strip in a `div` that stretches with the row (`position: relative`), the SVG absolutely filling it.
**Decision:** Fix now (applied) - D6 now names a wrapping `div.sft-chart-sankey-leader-strip` with the SVG inside.

### W2 [WARNING] A missing row must still say it is missing
**Effort:** low. **Lens:** Accessibility. **Where:** D2.
**Problem:** the dashed track is hidden from assistive technology; a missing row reads only label and value.
**Fix:** the value text is the app's (it passes e.g. "no data"), as for every row; document that the value label
carries the state.
**Decision:** Accept risk - copy belongs to the app (no inline copy in components); README states it.

### W3 [WARNING] `leaders` with `labels="none"`
**Effort:** low. **Lens:** Coverage. **Where:** D4/D6.
**Problem:** an app may pass both.
**Fix:** ignore `leaders` without label columns, and say so in the prop's doc comment.
**Decision:** Fix now (applied) - stated in D6 ("only with `labels="beside"`"), tested.

### S1 [SUGGESTION] Props for the two opacities
**Effort:** low. **Lens:** Coverage.
**Problem:** an app might prefer props over custom properties.
**Decision:** Dismiss - the label width is already a custom property; one way to theme the Sankey keeps it simple.

## Triage summary

Fixed: W1, W3. Accepted: W2. Deferred: -. Dismissed: S1. Verdict after triage: ready.

## Decisions (auto)

- W2 accepted: the state of a missing row is carried by the app's value label.

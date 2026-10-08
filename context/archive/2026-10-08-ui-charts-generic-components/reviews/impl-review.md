# Implementation review: ui-charts-generic-components

Reviewed: the branch diff against plan.md (D1–D6), change.md and the package conventions (slots, `unstyled`, no
inline copy, server-safe files without `"use client"`).

## Plan conformance

- D1 `Tabs`: roles, `aria-controls`/`aria-labelledby`, roving `tabIndex`, wrap, Home/End, `automatic`/`manual`,
  controlled and uncontrolled, `isAlwaysMounted`, segment look, slots. Done.
- D2 `TabPanels`: server-safe, same mounting rule, `data-tab-panel`, no role. Done.
- D3 `CollapsibleSection` + shared `DisclosureArrow`; `CardDisclosure` arrow markup asserted unchanged. Done.
- D4 `SegmentedNav`: named `<nav>`, `aria-current`, `LinkComponent`, slots. Done.
- D5 `smoothLinePath`, `areaPath` (number or lower-edge baseline, linear or smooth). Done.
- D6 `SeriesLine` `curve`, default markup unchanged (test). Done.

## Findings

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| I1 | Warning | `Tabs` manual mode: the blur of the tab an arrow leaves resets the focus index before the handler sets the new one. | Verified harmless: both updates batch in the same handler and the later one wins; the manual test checks the roving stop moves to the focused tab. |
| I2 | Suggestion | `SegmentedNav` also writes `data-current` on the current link, which the plan did not name. | Kept as a styling hook next to `aria-current` (the same idea as `data-tab-panel`); no copy, no behaviour. |
| I3 | Suggestion | A `Tabs` panel has `tabIndex={0}` even when it holds focusable content. | Kept: the WAI-ARIA pattern allows it and it keeps a text-only panel reachable; an app can override through the `panel` slot only for classes, so this is noted rather than made optional. |
| I4 | Suggestion | `areaPath` with a lower edge of a different x-range closes with a slanted segment. | Documented in the JSDoc and README (plan F3); no guard. |

No blocking findings. Tests were seen red before the code (ui 16 of 17 red, the arrow guard green by design; charts
13 of 13 red), then green.

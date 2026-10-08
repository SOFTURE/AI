# Plan review: ui-charts-generic-components

Reviewed: plan.md against change.md, issue #252 and the package code (`segment-classes.ts`, `button.tsx`,
`card-disclosure.tsx`, `class-names.ts`, `geometry.ts`, `lines.tsx`, both architecture tests).

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| F1 | Warning | D1 unmounts inactive panels; an app that expects every panel to keep its state (an uncontrolled form) loses a draft on switch unless it sets `isAlwaysMounted`. | Accepted as designed (only the active panel renders, the app's rule); the README says so and the test covers `isAlwaysMounted` keeping typed text. |
| F2 | Warning | D3 moves the arrow out of `CardDisclosure`; any drift in its attributes changes existing markup. | Added to Phase 1 tests: the `CardDisclosure` arrow's markup is asserted unchanged (attribute by attribute). |
| F3 | Warning | D5 with a lower edge assumes both edges span the same x-range; mismatched edges draw a slanted closing segment. | No code guard (the shape is still valid SVG); the JSDoc and README name the requirement. |
| F4 | Suggestion | Manual activation (D1) needs its own focus index apart from the selected one, or arrows would select. | Kept in D1; a test presses arrows in manual mode and checks the selection stays until Enter. |
| F5 | Suggestion | `SegmentedNav` links for a query-param switch: Next's `Link` scrolls to top by default. | README shows a `LinkComponent` wrapper passing `scroll={false}`; no extra prop. |
| F6 | Suggestion | Monotone curve on non-increasing x (a reversed lower edge). | Fritsch–Carlson is symmetric under reversal (same secants and tangents, negative thirds); a test compares the reversed edge with the forward one. |

No blocking findings. Plan accepted with F2 and F4 folded into Phase 1 and F6 into Phase 2.

---
change_id: theme-notion-scrollable-tabs-908
verdict: approved
---

# Implementation review

Reviewed the diff of 6adfc91 against plan.md and master (a29959c).

- Acceptance of #908: the fit spec renders six tabs in a 288 px grid cell at 390 and 1440 px: the list stays inside
  the cell, the `Tabs` root does not widen, the list is scrolled and the fifth (active) tab is fully visible.
  `ScrollArea scrollbars` draws the vertical, horizontal or both bars (tests). Documented in the README component notes,
  the CHANGELOG and the fixture (`TabsList[scrollable=…]`, `ScrollArea[scrollbars=horizontal]`).
- Centring sets `scrollLeft` on the list only, so the page never scrolls; it follows `data-state` changes, so a
  controlled `value` is centred as well as a click. The caller's `ref` still reaches the list.
- Defaults: a plain list renders the same classes; every `Tabs` root gains `has-data-[scrollable=true]:min-w-0`,
  which matches only around a scrollable list (fixture diff reviewed).
- Guards: deltas for `tabs.tsx` and `scroll-area.tsx`, the new cva axis drawn in the gallery, baselines refreshed;
  typecheck, ESLint, language, the theme's tests and the visual suite are green.

Verdict: approved.

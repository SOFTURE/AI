---
change_id: theme-notion-fold-row-padding-832
verdict: approved
---

# Implementation review

Reviewed the diff from 163d87a against plan.md.

- Acceptance of issue #832: without the prop `fold-row-content` is `flex flex-col gap-2 p-3 empty:hidden` (12 px on all
  four sides); `isInset` gives today's `py-2 pr-1 pl-6` and `data-inset="true"`; tests pin both class strings exactly.
- Nice-to-have: `summary` replaces the heading, facts and badges after the component's own chevron, inside the same
  `<summary>` (hover, focus ring and open background unchanged); `details`/`detailsLabel` are optional together and no
  `DetailTable` renders without them. A test covers the slot with list content and no table.
- Types: discriminated unions; `summary` with `title`, or `details` without `detailsLabel`, is a type error. Existing
  calls compile unchanged (gallery case, tests, README example).
- Consistency with #831: the same `isInset` name, default `false`, and `data-inset` marker.
- Gates: the parity fixture and the four gallery baselines were refreshed (two new cases, the closed rows look the
  same); typecheck, lint, language gate and the theme-notion suite (819 tests) green.

Verdict: approved, no changes.

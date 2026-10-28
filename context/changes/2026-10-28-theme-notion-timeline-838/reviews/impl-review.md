---
change_id: theme-notion-timeline-838
verdict: approved
---

# Implementation review

Reviewed the branch against plan.md and the acceptance of issue #838.

- API: every prop the issue lists (`label`, `time`, `title`, `description`, `badges`, `children`, `aside`, `size`,
  `color`, `icon`, `line`, `onSelect` + `actionLabel` as a union, `data`). No hooks, no `"use client"`.
- Rail: one segment per entry in the 24 px marker column; first from its marker's centre, last to its marker's centre,
  none for a single entry; checked in the rendered gallery in light and dark (desktop) for both sizes. Markers are
  opaque (tag fill, or the page background behind a compact icon or dot), so the rail never crosses them.
- Nesting: `children` and `aside` render outside the body's button (static test and a happy-dom click test: a click
  on an aside button does not select the entry).
- Accessibility: the marker and rail are `aria-hidden`; axe passes on the gallery in all four projects after
  `actionLabel` moved from `aria-label` to an `sr-only` prefix (label in name, WCAG 2.5.3); recorded in plan.md.
- `data`: spread before the component's own attributes, so it cannot replace `data-slot`, `data-size`, `data-color`
  or `data-line` (tested).
- Tests: 14 static, 2 behaviour; parity fixture and the four `gallery.png` baselines refreshed (only those files).
- Gates: typecheck, lint and the theme-notion suite green; `npm test` runs in the pre-push hook.
- Note for the badges slot: it sits inside the button when `onSelect` is set, so it is for statuses and tags; the
  README says so through "marks go in `aside`".

Verdict: approved, no changes.

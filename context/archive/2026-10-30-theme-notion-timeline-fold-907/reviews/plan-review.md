---
change_id: theme-notion-timeline-fold-907
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and master (a29959c).

- Acceptance of #907: a timeline entry folds by pointer and keyboard (a native button) with `aria-expanded`; its
  summary is at least the touch target high; documented in the README and the parity fixture. Phases 1 and 2.
- Server safety: `Timeline.tsx` gains no `"use client"`; the client parts come from `ui/collapsible.tsx`, and
  `onOpenChange` is only passed when an app (then a client component) gives it.
- Compatibility: entries without `fold` keep their markup; `FoldRow`'s default summary keeps its classes, reordered.
- Inventory: no new `src/notion` file, one new exported type from the root.

Verdict: approved, no changes.

---
change_id: theme-notion-scrollable-tabs-908
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and master (a29959c).

- Acceptance of #908: a strip of six tabs in a 288 px cell scrolls without widening its parent and shows the active
  tab (fit spec at phone and desktop widths); `ScrollArea` draws a horizontal bar; documented in the README and the
  parity fixture. Phases 1 and 2.
- Compatibility: `scrollable` defaults to `false` with an empty class; the root's `has-data-…` class matches only a
  scrollable list.
- The underline: `pb-1.5` keeps the line variant's active underline inside the scroll box, which clips overflow.
- Keyboard: Radix's arrow keys move focus, and focus scrolls the trigger into view.

Verdict: approved, no changes.

---
change_id: theme-notion-timeline-838
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and `themes/theme-notion` on master cda7e5f.

- Scope: one generic composition with every prop the issue lists; no domain meaning (stays, moves) enters the
  package.
- Server-safe: no hooks; `onSelect` only adds an `onClick`, so a server render without it works.
- Nesting: content and aside sit outside the body's button, so a `MarkPopover` or a link never lands inside a button
  (the acceptance names this).
- Accessibility: `<ol>` with a name keeps the order; the marker is `aria-hidden`; the button carries `actionLabel`;
  the focus ring and hover follow the list rows.
- Tailwind: every class is a literal (per-colour maps, per-size maps, first/last rail offsets).
- Tests cover every acceptance point; the gallery adds one case per size and the baselines follow.

Verdict: approved, no changes.

---
change_id: theme-notion-steps-738
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and `themes/theme-notion` on master e6d049c.

- Scope: one generic composition with the attributes the acceptance names; no domain meaning enters the package.
- Tailwind: the file sits under `src/notion/`, already a theme source; the per-state classes are a literal map and
  the current card uses `data-[state=current]:bg-blue-bg`, also literal.
- Accessibility: `<ol>` keeps the order, the visible number is hidden from assistive technology so it is not read
  twice, and the state word covers what colour alone would carry; `aria-current="step"` marks the current one.
- Copy: the state words join the built-in English copy with a prop to replace them, as every other text does.
- Tests cover every acceptance point: numbering, `aria-current` on one step only, both layouts, root export.

Verdict: approved, no changes.

---
change_id: theme-notion-touch-sizes-859
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and master (a5301e4).

- Acceptance of #859: `Button` `touch`/`icon-touch`, `SelectTrigger` `size="touch"`, `SelectItem` at the touch height
  (per list or per item), the optional desktop fallback. Covered by phase 1; the fallback is a documented caller class
  rather than new sizes, recorded under Decisions with its reason.
- Compatibility: only new union members and optional props; existing class strings stay, so the fixture diff holds
  only new cases.
- Guards: deltas, parity fixture and the Tailwind class test cover the new classes.
- Context in `select.tsx`: the file is already `"use client"`; a default value keeps items outside a sized content at
  28 px.

Verdict: approved, no changes.

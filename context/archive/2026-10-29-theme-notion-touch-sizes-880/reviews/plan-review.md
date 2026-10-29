---
change_id: theme-notion-touch-sizes-880
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and master (eea00c6).

- Acceptance of #880: `DropdownMenuContent`/items `size="touch"` with the item winning, `TabsList`/`TabsTrigger` the
  same, `AccordionTrigger size="touch"`, Dialog's close button at the `icon-touch` size by opt-in prop. All in phase 1.
- Compatibility: only optional props; the default branch renders the same class set (`min-h-7` moves into a
  condition, order only), so the fixture diff holds new cases and reordered classes.
- Tabs: a touch list drops its fixed `h-9`, otherwise the triggers' `h-[calc(100%-1px)]` would cap them at 35 px;
  covered by the cva variant.
- Contexts: both files are `"use client"`; defaults of `"default"` keep items outside a sized list unchanged.

Verdict: approved, no changes.

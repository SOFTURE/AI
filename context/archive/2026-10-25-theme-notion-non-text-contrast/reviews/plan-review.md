---
change_id: theme-notion-non-text-contrast
verdict: approved
---

# Plan review

Reviewed against change.md, research.md, the class strings in `src/ui` and `src/notion`, and `tests/contrast.test.ts`.

- Scope: two token values and four class strings; no export changes. Decorative separators untouched, as the issue asks.
- Look: hue kept; field borders read as a mid grey; buttons, button groups and dark tabs keep their old weight by
  moving to `border`. Before/after screenshots go to the coordinator.
- Risks: `tailwind-merge` keeps a `dark:` class next to an override, so the dark progress fill must be part of the
  default only (step 3 covers it). The bridge's `border-strong` follows `control-off` and gains 3:1 as well.
- Tests: the snapshot keeps tokens and fixture equal; the contrast test gains the non-text pairs.

Verdict: approved, no changes.

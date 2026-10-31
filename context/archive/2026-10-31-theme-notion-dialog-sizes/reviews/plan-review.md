---
change_id: theme-notion-dialog-sizes
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and master.

- Acceptance: `lg` leaves a quarter free on every side from `lg` (`max-w-1/2`, `h-1/2`, centred by the existing
  translate), keeps the phone gutter, and scrolls; `sm` is narrower with a height cap. Phase 1 tests each class set.
- Compatibility: `default` and `wide` keep their exact classes; the sizes only add classes after the base, resolved
  by `tailwind-merge` (`flex` over `grid`, `sm:max-w-md` over `sm:max-w-lg`).
- Risk: `h-1/2` on a fixed element resolves against the viewport; `lg:min-h-96` could exceed a window shorter than
  24 rem, which no laptop has.

Verdict: approved, no changes.

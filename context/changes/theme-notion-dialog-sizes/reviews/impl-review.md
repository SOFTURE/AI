---
change_id: theme-notion-dialog-sizes
verdict: approved
---

# Implementation review

- `src/ui/dialog.tsx`: `lg` and `sm` add classes after the base; `cn` resolves `flex` over `grid` and the size's
  `sm:max-w-*` over `sm:max-w-lg`; `default` and `wide` unchanged (tests assert no height class and `grid` on both).
- Tests: six new cases in `tests/ui/dialog.test.tsx` (each size's classes, the app's className overriding padding
  and gap); the upstream guard passes with the extended deltas; the full theme-notion suite is green.
- Docs: README `dialog` note and CHANGELOG `## Unreleased`.

Verdict: approved.

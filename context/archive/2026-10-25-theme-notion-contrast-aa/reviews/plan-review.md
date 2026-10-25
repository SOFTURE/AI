---
change_id: theme-notion-contrast-aa
verdict: approved
---

# Plan review

Reviewed against change.md, research.md, the class strings in `src/ui` and `src/notion`, and `tests/tokens.test.ts`.

- Scope: token values, one additive colour (`link`), class changes in five components; no export changes.
- Look: lightness-only shifts keep hue and chroma; before/after screenshots of both schemes go to the coordinator.
- Risks: an app that hard-codes `text-primary` for text on a dark surface keeps the old shortfall; the CHANGELOG
  names the move to `text-link`. `primary-hover` must stay darker than `primary`; the contrast test checks white on
  both.
- Tests: the snapshot test keeps tokens and fixture equal; the new contrast test guards every pair.

Verdict: approved, no changes.

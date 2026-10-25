---
change_id: theme-notion-test-suite-741
title: "theme-notion: full test suite so the design system cannot drift (issue #741)"
status: archived
roadmap_item: null
issue: 741
branch: claude/project-thread-rtvg34
created: 2026-10-25
updated: 2026-10-25
archived_at: 2026-10-25
---

## Intent

Close [issue #741](https://github.com/SOFTURE/AI/issues/741): `@softure-ai/theme-notion` gets a test suite in eight
layers (every export renders, a class parity fixture, an upstream delta guard against pinned shadcn new-york v4
sources, behaviour, Tailwind generation, visual regression, accessibility, inventory), so a class string that drifts
from the design system, like the four of #735, cannot be merged.

## Context

- Labels: `enhancement`, `pkg: theme-notion`.
- #735 (misplaced class strings) and #736–#740 (RadioGroup, FilterChip, Steps, StatCard progress, Code/CodeBlock)
  are carried by parallel threads; this suite must cover their parts too, so the fixture, the inventory and the
  visual baselines are finalised only once they are on master (the coordinator's word).
- Today UI tests cover only alert, badge, button, table and tabs.

## Constraints

- Layers 1–5 and 8 run in the package's `test` gate (`npm test`); 6–7 in CI on every pull request touching `themes/`.
- Coverage of `themes/theme-notion/src` at least 90% statements and branches.
- No component change beyond what a failing test proves wrong; no version bump (the coordinator releases).
- English only; the tests must pass on macOS (`npm test` is the pre-push hook there).

## Notes

- Framing: skipped. The issue names the layers and the acceptance.

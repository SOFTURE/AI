---
change_id: theme-notion-contrast-aa
title: "theme-notion: every text colour meets WCAG AA contrast (issue #756)"
status: archived
roadmap_item: null
issue: 756
branch: claude/project-thread-zxg237
created: 2026-10-25
updated: 2026-10-25
archived_at: 2026-10-25
---

## Intent

Close [issue #756](https://github.com/SOFTURE/AI/issues/756): every text/background pair that the theme's own parts
render meets WCAG 2.2 AA (4.5:1 for text, 3:1 for the focus ring) in light and dark, while the theme keeps the Notion
look: lightness shifts only, hue and chroma kept, by the smallest step that passes.

## Context

- Labels: bug, adoption, pkg: theme-notion. The owner asked to darken the tokens to WCAG compliance and keep the look.
- Issue #741 (the theme's full test suite) adds AA thresholds and axe `color-contrast` after this change; its axe run
  listed the failing pairs, all covered here.

## Constraints

- Tokens stay equal to the snapshot in `tests/fixtures/notion-tokens.json`; the snapshot is updated with them.
- No version bump; the coordinator releases in a batch.

## Notes

- Framing: skipped. The issue measures every failing pair and names the outcome.

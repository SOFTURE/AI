---
change_id: theme-notion-code-badge-contrast
title: "theme-notion: inline Code and a destructive Badge with a colour meet WCAG AA text contrast (issue #763)"
status: archived
roadmap_item: null
issue: 763
branch: claude/project-thread-sjmx1z
created: 2026-10-25
updated: 2026-10-25
archived_at: 2026-10-25
---

## Intent

Close [issue #763](https://github.com/SOFTURE/AI/issues/763): inline `Code` reaches 4.5:1 in light and dark, and a
destructive `Badge` keeps `destructive-foreground` on its own fill whatever `color` it is given, so the axe
`color-contrast` run of the #741 suite finds no known violation left for these parts. The look stays Notion's.

## Context

- Labels: bug. Package: `@softure-ai/theme-notion`. Found by the #741 suite (PR #754) after #756.
- Based on the branch of PR #762 (#760), which carries PR #761 (#759); both wait to merge. Fresh master merged in.
- The owner asked for WCAG compliance that still looks good.

## Constraints

- No version bump; the coordinator releases in a batch.
- Other parts that use `red` keep their colour: only inline code moves.

## Notes

- Framing: skipped. The issue measures the failing pairs and names the candidate fixes.

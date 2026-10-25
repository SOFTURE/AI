---
change_id: theme-notion-tab-state-contrast
title: "theme-notion: the selected tab of the default Tabs variant meets WCAG 1.4.11 state contrast (issue #760)"
status: in_progress
roadmap_item: null
issue: 760
branch: claude/project-thread-hp4xeo
created: 2026-10-25
updated: 2026-10-25
---

## Intent

Close [issue #760](https://github.com/SOFTURE/AI/issues/760): the selected tab of the default (pill) `Tabs` variant
carries a state indicator that reaches 3:1 against the unselected tabs and the list in light and dark (WCAG 2.2
SC 1.4.11), with the smallest change that keeps the Notion look. The `line` variant already passes.

## Context

- Labels: bug, pkg: theme-notion. Found while closing #759 (PR #761), whose `tests/contrast.test.ts` this change
  extends. The owner asked for WCAG compliance that still looks good.
- Based on the branch of PR #761 (#759), which carries PR #758 (#756) and PR #757 (#746); all wait to merge.

## Constraints

- No token change: #756 and #759 set the values; this change only uses them.
- No version bump; the coordinator releases in a batch.

## Notes

- Framing: skipped. The issue measures the failing pair and names two candidate fixes.

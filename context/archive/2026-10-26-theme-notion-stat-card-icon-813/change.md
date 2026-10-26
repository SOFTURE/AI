---
change_id: theme-notion-stat-card-icon-813
title: "theme-notion: optional icon before a StatCard's label (issue #813)"
status: archived
roadmap_item: null
issue: 813
branch: claude/project-thread-x2eewi
created: 2026-10-26
updated: 2026-10-26
archived_at: 2026-10-26
---

## Intent

Close [issue #813](https://github.com/SOFTURE/AI/issues/813): a `StatCards` card can show a 16 px Lucide icon before
its label (muted, 6 px gap, `ICON_STROKE_WIDTH`), so an adopting app keeps the design's icon without rebuilding the
card from `Card`.

## Context

- Labels: enhancement, pkg: theme-notion. Found while adopting theme-notion 0.4.0 in an adopting app.
- File: `themes/theme-notion/src/notion/Stats.tsx`.

## Constraints

- Additive: a card without `icon` renders byte-equal to today.
- The icon is decorative (`aria-hidden`); the label stays the card's accessible text.
- No version bump: the coordinator releases theme-notion. #809 (PR #812) also edits the CHANGELOG: master is merged
  in before the merge.
- theme-notion stays consistent with the "NOTION · Design System" artifact.

## Notes

- Framing: skipped. The issue names the gap, the API and the acceptance.

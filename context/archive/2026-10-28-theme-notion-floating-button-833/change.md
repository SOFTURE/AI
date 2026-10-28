---
change_id: theme-notion-floating-button-833
title: "theme-notion: a Button that stays opaque over a map or an image (issue #833)"
status: archived
roadmap_item: null
issue: 833
branch: claude/project-thread-i54udz
created: 2026-10-28
updated: 2026-10-28
archived_at: 2026-10-28
---

## Intent

Close [issue #833](https://github.com/SOFTURE/AI/issues/833): a `Button` that floats over content (a map, an image)
keeps an opaque surface in every state, with the theme's hover and pressed tint on top, in both schemes. Today the
`outline` variant swaps its opaque `bg-background` for the translucent `bg-accent` on hover, so the content under it
shows through and the label becomes unreadable.

## Context

- Labels: bug, pkg: theme-notion. Found while adopting theme-notion 0.5.0 in an adopting app.
- File: `themes/theme-notion/src/ui/button.tsx` (with its tests, the gallery and the parity fixture).
- `--accent` and `--accent-strong` are translucent by design (Notion's grey hover over any surface).

## Constraints

- Variants other than `outline` render as before.
- No new tokens: the tint stays `--accent` / `--accent-strong`, laid over an opaque `--background`.
- No version bump: the coordinator releases theme-notion. #831 and #832 also edit theme-notion (CHANGELOG):
  master is merged in before the merge.
- theme-notion stays consistent with the "NOTION · Design System" artifact.

## Notes

- Framing: skipped. The issue names the defect, the expected result and two proposals.

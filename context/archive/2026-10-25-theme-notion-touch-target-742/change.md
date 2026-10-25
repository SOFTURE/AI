---
change_id: theme-notion-touch-target-742
title: "theme-notion: a touch-target size token for phone list rows (issue #742)"
status: archived
roadmap_item: null
issue: 742
branch: claude/project-thread-5qfylo
created: 2026-10-25
updated: 2026-10-25
archived_at: 2026-10-25
---

## Intent

Close [issue #742](https://github.com/SOFTURE/AI/issues/742): `@softure-ai/theme-notion` names a size for a finger,
`--spacing-touch-target: 44px`, so `min-h-touch-target` and `size-touch-target` work in Tailwind and an adopting app
stops falling back to the unnamed `min-h-11` for rows tapped on a phone.

## Context

- Labels: `enhancement`, `pkg: theme-notion`.
- The theme has `control-height` (28 px) and `row-height` (34 px), both sized for a pointer.

## Constraints

- Value 44 px (Apple HIG 44 pt, WCAG 2.5.5 target size); listed in the sizes next to `row-height` and
  `control-height`, with the rule: use it for rows and controls meant to be tapped on a phone.
- No change to existing components or tokens; English only; no version bump (batched release).

## Notes

- Framing: skipped. The issue names the token, its value and where it is listed.

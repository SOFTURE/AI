---
change_id: theme-flat-paint-swatch-1280
title: "theme-flat-paint: native colour picker wider than tall (issue #1280)"
status: open
roadmap_item: null
issue: 1280
branch: claude/project-thread-ut62r9
created: 2026-11-16
updated: 2026-11-16
---

## Intent

Close [issue #1280](https://github.com/SOFTURE/AI/issues/1280): `COLOR_FIELD_LOOK.swatch` gives `ColorField`'s native
picker the orientation of the app the look was taken from, 36 px wide and 28 px tall (`w-9 h-7`), not the swapped
`h-9 w-7`.

## Context

Labels: `bug`, `pkg: theme-flat-paint`, `adoption`. Package: `themes/theme-flat-paint` 0.4.0. The look map came from
#782 (`context/archive/2026-10-26-theme-flat-paint-look-maps-782/`), whose plan read "28 × 36 px" as width × height;
the source app had the picker as `w-9 h-7`. No version bump: the coordinator releases the batch.

## Scope

- `COLOR_FIELD_LOOK.swatch`: `w-9 h-7` instead of `h-9 w-7`, its doc comment says 36 × 28 px (width × height).
- Test pins the new class string; CHANGELOG `## Unreleased`.

## Constraints

- Other slots of `COLOR_FIELD_LOOK` and other look maps unchanged.

## Notes

- Research: skipped. The issue names the source app's classes and the #782 archive shows the misread; nothing else
  to find.
- Framing: skipped. The problem is a swapped pair of utilities.

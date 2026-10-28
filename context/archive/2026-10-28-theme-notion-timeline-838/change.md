---
change_id: theme-notion-timeline-838
title: "theme-notion: Timeline, a vertical rail of dated entries with markers (issue #838)"
status: archived
roadmap_item: null
issue: 838
branch: claude/project-thread-xewhx9
created: 2026-10-28
updated: 2026-10-28
archived_at: 2026-10-28
---

## Intent

Close [issue #838](https://github.com/SOFTURE/AI/issues/838): export a `Timeline` composition, an ordered list of
entries joined by one continuous vertical rail. Each entry has a marker on the rail (a 24 px tag-coloured circle with
an optional icon, or a compact icon or dot for a minor entry), an optional time line, a title, an optional
description, badges, content under the body and an aside at the right edge. A dashed rail marks a gap; `onSelect`
turns the body into a button.

## Context

- Labels: enhancement, pkg: theme-notion. Found while adopting theme-notion in an adopting app (a trip shown as stays
  joined by moves, with gaps and marks).
- New file `themes/theme-notion/src/notion/Timeline.tsx`, with its tests, the gallery, the parity fixture, the visual
  baselines, README and CHANGELOG.
- `Steps` is an ordered process with states and stays as it is.

## Constraints

- No hooks and no `"use client"`: it renders on the server without `onSelect`; an app's client component passes
  `onSelect`.
- Literal class names only (the theme's `@source` covers `src/notion/`); design tokens only.
- A colour never stands alone: the entry's words carry the meaning; the marker is hidden from assistive technology.
- No version bump: the coordinator releases theme-notion. #839 may touch theme-notion in parallel (CHANGELOG): master
  is merged in before the merge.
- theme-notion stays consistent with the "NOTION · Design System" artifact (a Timeline component card).

## Notes

- Framing: skipped. The issue gives the API, the look and the acceptance.

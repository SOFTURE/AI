---
change_id: theme-notion-list-group-1350
title: "theme-notion: a sticky group heading for List (issue #1350)"
status: archived
archived_at: 2026-11-18
roadmap_item: null
issue: 1350
branch: claude/project-thread-r9jj5w
created: 2026-11-18
updated: 2026-11-18
---

## Intent

Give apps one part for a heading over a run of rows (a country's days, a month's entries) that sticks at the top of the
list's scroll container while its rows pass under it and is pushed away by the next group's heading, so an app no
longer composes the padding, the bleed, the surface, the divider and the scroll margin from tokens.

## Context

Issue #1350 (`enhancement`, `pkg: theme-notion`, `adoption`). theme-notion 0.25.0 has `List`, `ListItem`, `ListRow`
(#1341, list density) and no group part. The adopting app's first composition washed out: the scroll container's top
padding left a strip above the stuck heading, the heading was narrower than the container, and a muted 12 px label
without a line read as part of the row below.

## Scope

- `ListGroup` and `ListGroupHeading` in `src/notion/List.tsx`, exported; `LIST_CLASSES.group`, `groupHeading`,
  `tintedGroupHeading`.
- Tests, gallery cases, parity fixture, inline gallery baselines, README, CHANGELOG; a minor release.

## Constraints

- No existing component changes; only the theme's tokens and Tailwind's spacing scale.
- A parallel change (#1349) edits the same package's shared files; the second to merge takes the next version and
  regenerates the gallery baselines.

## Notes

- Research and frame skipped: one small additive composition whose classes the issue already measured in an adopting
  app; the look is the theme's (`text-ui-medium`, `border`, `background`, `secondary`).

## Done

- `ListGroup` and `ListGroupHeading` in theme-notion 0.26.0 (released by the coordinator's release run).

## Decisions (auto)

- Two parts (`ListGroup` wrapping a `ListGroupHeading` and a `List`) instead of a `sticky` prop: the group is the
  heading's containing block, so the browser pushes the stuck heading away when its group ends, with no script.
- The group, not the scroll container, holds the `px-2` side room; the heading bleeds over it (`-mx-2 px-4`), so its
  text lines up with the rows' and it spans the scrollport. The scroll container needs no padding.
- A fixed heading height (`min-h-10`, 40 px) matched by `scroll-mt-10` on every `ListItem` in the group; the heading
  does not follow the density, so the scroll margin stays exact in both.
- `surface="tinted"` takes `secondary` (the grey card the List's tinted line is made for); an app on a `muted` card
  passes its own `bg-muted`.

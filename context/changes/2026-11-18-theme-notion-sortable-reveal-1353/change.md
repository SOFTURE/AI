---
change_id: theme-notion-sortable-reveal-1353
title: "theme-notion: a SortableHandle that shows only while its row is hovered or focused (issue #1353)"
status: open
roadmap_item: null
issue: 1353
branch: claude/project-thread-5v60lf
created: 2026-11-18
updated: 2026-11-18
---

## Intent

Let a Notion-style list show the drag grip only while the pointer is over the row, the focus is inside it or the row
is lifted, and keep it always visible on touch screens, so an app no longer composes the reveal from Tailwind variants
and a named group of its own.

## Context

Issue #1353 (`enhancement`, `pkg: theme-notion`, `adoption`). theme-notion 0.27.0: `SortableHandle` is always
visible; an adopting app adds `group/<name>` to `SortableItem` and five `pointer-fine:` variants to the handle.

## Scope

- `SortableHandle` gets `reveal?: "always" | "hover"` (default `"always"`), marked by `data-reveal`.
- `SortableItem` carries `group/sortable-item`.
- Tests (component and generated CSS), parity fixture, README, CHANGELOG; a minor release.

## Constraints

- The default stays `"always"`: no existing list changes its look, so no gallery baseline moves.
- The hidden handle keeps its place, its tab stop and its hit area (opacity, never `hidden`).

## Notes

- Research and frame skipped: one additive prop whose classes the issue already measured in an adopting app; the
  sidebar's own `group-hover/menu-item:opacity-100` action is the in-package precedent.

## Decisions (auto)

- The fade reuses the button's own `transition-all` (150 ms) and only adds `motion-reduce:transition-none`; the issue's
  `duration-120` is left out so the grip and its hover background keep one timing.
- No gallery case for `reveal="hover"`: the static screenshot would show an empty slot. The reveal is proven by a test
  on the CSS Tailwind generates and a browser check (fine and coarse pointer, hover, focus).
- A nested `SortableList` inside a row would reveal its handles with the outer row's hover too (the group name is
  shared); accepted, nested sortable lists are not a supported layout.

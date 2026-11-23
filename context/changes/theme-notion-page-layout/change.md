---
change_id: theme-notion-page-layout
title: "theme-notion 0.31.0: a page layout for a screen's width and spacing (issue #1451)"
status: open
roadmap_item: null
issue: 1451
branch: claude/project-thread-u44zan
created: 2026-11-23
updated: 2026-11-23
---

## Intent
Every screen of an app inside the shell has the same width and the same spacing between its `PageHeader` and its
sections, without a local wrapper per app. Issue #1451 (`enhancement`, `pkg: theme-notion`, `adoption`).

## Context
theme-notion ships `PageHeader`, `Card` and `PageFrame` (a page outside the shell), but nothing that lays out a page
inside the shell. An adopting app wrote its own `PageLayout` (`grid w-full min-w-0 gap-4`, the header, the children)
plus a test that every page uses it.

## Scope
- A `PageLayout` component: `header` (the `PageHeader` props), children, `width` (`full` default, `content`), `className`.
- Tests, README, CHANGELOG, version 0.31.0.
- Out of scope: changing the adopting app (its migration is described in the CHANGELOG).

## Decisions (auto)
- Name `PageLayout`, not `Page`: `Page` is the default export name of every Next.js route file, so an import would clash.
- `header` is one prop holding `PageHeaderProps`, not spread props: `PageHeader` has its own `children` and `className`,
  which would collide with the layout's.
- Spacing `gap-4` (16 px), the value the adopting app settled on and the gap of the theme's card grids; `min-w-0` so a
  wide table scrolls inside its card instead of widening the page.
- `width="content"` caps the page at `max-w-3xl` (48 rem) and centres it, the Notion reading width; `full` (default)
  takes the content area's width.
- Minor version 0.31.0: a new export; no package depends on theme-notion, so no range breaks.

## Notes
- research skipped: the gap, the app's working wrapper and the proposal are all in the issue; the component composes `PageHeader` only.
- frame skipped: the problem is a reported, reproduced gap with one proposed shape.

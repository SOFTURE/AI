---
change_id: theme-notion-result-badge-attributes
title: "theme-notion: ResultBadge passes the app's data-* attributes and id to its badge (issue #1493)"
status: archived
roadmap_item: null
issue: 1493
branch: claude/project-thread-ilfyuv
created: 2026-11-26
updated: 2026-11-26
archived_at: 2026-11-26
---

## Intent
An adopting app marks each `ResultBadge` with what it shows (`data-read-status="ok"`, `data-answer-state="sending"`)
and its tests read those attributes, without wrapping every badge in an extra element. The theme's own `data-slot`,
`data-tone`, `data-color` and `data-spinning` stay the theme's. Issue #1493 (`bug`, `pkg: theme-notion`).

## Context
`ResultBadge` (0.34.0, #1481) takes only `tone`, `icon`, `isSpinning`, `children`, `title` and `className`; every other
prop is dropped before its `Badge`. An app that replaces its own result badge with the theme's (the 0.34.0 migration
note) loses the attributes its unit and browser tests read.

## Scope
- `ResultBadgeProps` extends the remaining `span` props of the `Badge` (`data-*`, `id`, ARIA and the rest) and spreads
  them on the badge before the component's own attributes.
- A unit test: `<ResultBadge tone="success" data-read-status="ok">` renders the attribute on
  `[data-slot=result-badge]`; an app's `data-tone`, `data-slot`, `data-color` and `data-spinning` cannot override the
  theme's.
- JSDoc, README, CHANGELOG `Unreleased`, the "NOTION · Design System" artifact.
- Out of scope: the adopting app; `Status` and other components.

## Decisions (auto)
- Recorded in `plan.md`.

## Notes
- frame skipped: a reported gap with a proposed shape and acceptance criteria in the issue.

## Done
`ResultBadge` passes every remaining `span` prop (`data-*`, `id`, ARIA) to its badge, before its own `data-slot`,
`data-tone`, `data-color` and `data-spinning`, so an app marks a badge with what it shows without wrapping it and the
theme's attributes stay the theme's. Tests (red first), README, CHANGELOG `Unreleased`, the Design System artifact
(v89-90); ships in the next theme-notion release.

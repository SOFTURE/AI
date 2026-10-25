---
change_id: theme-notion-crumbs-label-719
title: "theme-notion: PageHeader passes the breadcrumb's accessible name (issue #719)"
status: archived
roadmap_item: null
issue: 719
branch: claude/project-thread-o4tpeo
created: 2026-10-25
updated: 2026-10-25
archived_at: 2026-10-25
---

## Intent

Close [issue #719](https://github.com/SOFTURE/AI/issues/719): `PageHeader` renders its own `Breadcrumb` for
`crumbs` but has no prop for the breadcrumb's accessible name, so an app in another language always announces the
built-in English "breadcrumb". Add an optional `crumbsLabel` prop passed to `<Breadcrumb aria-label>` and list it in
the README's "Copy" section.

## Context

Labels: `enhancement`, `pkg: theme-notion`. Found while an adopting app moved onto theme-notion 0.1.1; nothing is
blocked. No release in this change: the coordinator releases theme-notion.

## Constraints

- Without `crumbsLabel` the markup stays exactly as today (the built-in `notionMessages.en.breadcrumb.label`).
- Theme-specific copy prop only; the theme-kit contract does not change.

## Notes

- Framing: skipped. The issue names the gap and the fix.

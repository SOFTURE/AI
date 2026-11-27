---
change_id: theme-notion-table-sort-head
title: "theme-notion: a sortable table column header with aria-sort and a sort indicator (issue #1528)"
status: planned
roadmap_item: null
issue: 1528
branch: claude/project-thread-cnkgw2
created: 2026-11-27
updated: 2026-11-27
---

## Intent
theme-notion ships `TableSortHead`: a table column header whose label is a ghost button with a chevron showing the
column's sort direction, `aria-sort` on the sorted `<th>`, the next direction announced to a screen reader through an
app-supplied text, a none → descending → ascending → none cycle (or a two-state one), and a stable `sortRows` helper,
so an app stops building its own header button, indicator and `aria-sort`. Issue #1528 (`enhancement`,
`pkg: theme-notion`).

## Context
theme-notion 0.41.1 has the shadcn `Table` family (`TableHead` is a plain `<th>`), kept in parity with shadcn
(`tests/upstream.test.ts`). Sorting stays in the app (client or server); the package gives the header, its states and
the accessible markup.

## Scope
- New composition `src/notion/TableSortHead.tsx` (`TableSortHead`, `nextSortDirection`, `sortRows`, `SortDirection`),
  exported from the package root, with English defaults for the announced next direction in `messages/en.ts`.
- Unit tests, the gallery case, the class fixture, the visual baselines, README, CHANGELOG `Unreleased`, the
  "NOTION · Design System" artifact.
- Out of scope: changing `TableHead` itself (shadcn parity); sorting state or data fetching in the package.

## Decisions (auto)
- Recorded in `plan.md`.

## Notes
- frame skipped: the issue names the gap and the proposed component and helper.

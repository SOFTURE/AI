---
change_id: theme-notion-detail-table-fit-1349
title: "theme-notion: DetailTable keeps to its column; DocumentRow details"
status: archived
archived_at: 2026-11-18
roadmap_item: null
issue: 1349
branch: claude/project-thread-wbkgag
created: 2026-11-18
updated: 2026-11-18
---

## Intent

An entry's details (`DetailTable`) never grow wider than their column, so beside an `AsidePanel` nothing runs under
the panel; a `DocumentRow` gets a place for a document's facts that wraps under its title, so its buttons always show
whole (#1349).

## Context

An adopting app's opened stay, leg and ticket rows show `DetailTable` with a `DocumentList` in one cell. The browser's
automatic table layout counts the full length of `DocumentRow`'s `truncate` title and its `shrink-0` actions (where
the app put the document's facts) in the cell's min-content width, so the table grows past its column: measured on a
1440 px window with the panel at `half`, the cells end at 1428 px while the column ends at 720 px.

## Scope

- `DetailTable`: `table-fixed`.
- `DocumentRow`: optional `details`, rendered after the size inside the row's wrapping open button.
- Unit tests, the class parity fixture, a geometry test in `visual/fit.spec.ts`, README, CHANGELOG; release 0.26.0
  (minor).

## Constraints

- Additive: no existing prop changes; the gallery's pixels stay the same.

## Notes

- Research and frame skipped: the cause was measured in the adopting app (element boxes past the panel's edge) and the
  fix is the standard CSS answer to it (fixed table layout); no product question is open.

## Decisions (auto)

- `details` sits inside the open button, after the size, so it wraps with the title's line and stays part of the
  button's name (every visible word of the row's button is in its name, as the title and size already are).
- No new gallery case: `table-fixed` changes no existing pixel and the fit test builds its own narrow case, so the
  baselines stay as they are.

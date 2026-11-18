---
change_id: theme-notion-detail-table-fit
title: "theme-notion: DetailTable keeps to its column, DocumentRow details wrap (issue #1349)"
status: in_progress
roadmap_item: null
issue: 1349
branch: claude/project-thread-m4fx3l
created: 2026-11-18
updated: 2026-11-18
---

## Intent

A `DetailTable` whose value cell holds a `DocumentList` must stay inside its page column (beside an `AsidePanel` too),
and a `DocumentRow` needs a place for a document's facts that wraps under the title instead of pushing the buttons out.

## Context

Issue #1349 (labels: `bug`, `pkg: theme-notion`). `DetailTable` uses the automatic table layout, so a cell's
min-content width (a `truncate` title, `shrink-0` actions) widens the table past its container: measured 1428 px of
cells in a 720 px column. `DocumentRow` only has `actions`, which never shrink.

## Scope

- `DetailTable`: `table-fixed`; the label column keeps `w-48`, the value column takes the rest.
- `DocumentRow`: optional `details` (text) after the size inside the wrapping open button; `actions` unchanged.
- Tests (unit and a geometry check in `visual/fit.spec.ts`), a gallery case, README, CHANGELOG, minor release.

## Constraints

- Additive: no existing prop changes; a table that already fits looks the same.

## Notes

- Research and frame skipped: the issue names the cause (automatic table layout, measured) and the fix; both parts are
  one class and one optional prop on components this package owns.

## Decisions (auto)

- `details` is `string`, as the issue proposes; it sits inside the open button (as the size does), so the button's
  name keeps every visible word.
- The geometry check clones the new gallery case into a narrow parent instead of a screenshot, like the badge fit check.

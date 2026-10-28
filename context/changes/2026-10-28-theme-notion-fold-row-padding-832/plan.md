---
change_id: theme-notion-fold-row-padding-832
status: in_progress
---

# Plan: FoldRow equal padding and isInset (issue #832)

Input: change.md, research.md. Complexity: small (one component, its test, docs, gallery).

## Phase 1: `FoldRow` (TDD)

Files: `themes/theme-notion/src/notion/FoldRow.tsx`, `themes/theme-notion/tests/notion/FoldRow.test.tsx`,
`themes/theme-notion/tests/gallery/cases.tsx`.

1. Tests first: without `isInset` the `fold-row-content` classes are exactly `flex flex-col gap-2 p-3 empty:hidden`
   and the row has no `data-inset`; with `isInset` they are `flex flex-col gap-2 py-2 pr-1 pl-6 empty:hidden` and the
   row carries `data-inset`. A `summary` node replaces the heading, facts and badges but keeps the chevron; without
   `details` no table renders and `children` still do.
2. `isInset?: boolean` (default `false`) picks the content classes; `data-inset` on the `<details>` marks it.
3. Props become `FoldRowSummaryProps & FoldRowDetailsProps & { isInset?, children? }`: a fixed summary
   (`title`, `facts?`, `badges`) or `summary: ReactNode`; a table (`detailsLabel`, `details`) or neither.
4. Gallery: add an inset case and a slot case.

## Phase 2: docs

`themes/theme-notion/README.md` (the `FoldRow` paragraph), `themes/theme-notion/CHANGELOG.md` under `## Unreleased`
with the migration line (add `isInset` to keep the old look).

## Phase 3: design system artifact

Mirror the change in "NOTION · Design System": rebuild `project/components/bundle.js` and `bundle.css`, update the
FoldRow preview, render-check light and dark, publish.

## Decisions (auto)

- Equal padding is `p-3` (12 px), the issue's example and the table's cell rhythm.
- `isInset` keeps today's exact classes (`py-2 pr-1 pl-6`), so an app restores the old look with one prop.
- `data-inset` marks the inset row (the pattern of `data-active` and friends), so tests and apps can select it.
- The nice-to-have is in this change: it is small and touches the same file.
- In the slot, the chevron stays the component's; the slot fills the rest of the summary as a wrapping flex row.
- No version bump: the coordinator releases.

## Progress

- [ ] Phase 1: FoldRow
- [ ] Phase 2: docs
- [ ] Phase 3: design system artifact
- [ ] Implementation review

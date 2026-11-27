# Plan: theme-notion-table-sort-head

## Approach
`src/notion/TableSortHead.tsx`:
- `type SortDirection = "ascending" | "descending" | "none"`; `type SortCycle = "three-state" | "two-state"`.
- `nextSortDirection(direction, cycle = "three-state")`: three-state none → descending → ascending → none; two-state
  none → descending → ascending → descending.
- `TableSortHead` renders `TableHead` (`data-slot="table-sort-head"`, `data-sort={direction}`, `aria-sort` only when
  the direction is not `none`) around a ghost `Button` (`data-slot="table-sort-button"`, `type="button"`) holding the
  column label (children), a chevron (`ChevronUp` ascending, `ChevronDown` descending, `ChevronsUpDown` muted for
  none; `ICON_STROKE_WIDTH`, `aria-hidden`) and a `sr-only` span with the announced next direction. A click calls
  `onSortChange(nextSortDirection(direction, cycle))`. Props: `direction`, `onSortChange`, `cycle`, `label` (the
  hidden text; default `messages.tableSortHead[next]`), `align` (`start` | `end`, for a right-aligned number column),
  `buttonClassName`, and every other `<th>` prop.
- `sortRows(rows, key, direction, compare?)`: a new array; `none` keeps the input order; a default comparator puts
  `null`/`undefined` last in both directions, compares numbers, bigints and dates by value, booleans false first, and
  strings with `Intl.Collator(undefined, { numeric: true, sensitivity: "base" })`; descending negates the comparison
  so equal rows keep their order. `key` is a property name or an accessor `(row) => value`.

## Phases
### Phase 1: TableSortHead and sortRows (TDD)
- Tests first (red) in `tests/notion/TableSortHead.test.tsx`: the cycles; `aria-sort` and `data-sort` per state;
  the icon per state; a click and the keyboard (button is focusable, Enter/Space reach the native click) call
  `onSortChange` with the next direction; the hidden label (default and given); `sortRows` stability in both
  directions, nulls last, numbers, dates, strings with numeric collation, accessor key, custom compare, `none`, input
  not mutated.
- Code, export, messages, messages test entry, gallery case, fixture, README, CHANGELOG `## Unreleased`, visual
  baselines.
- Done when: `npx vitest run themes/theme-notion` passes; typecheck, lint and build pass; visual baselines updated.

### Phase 2: Design System artifact
- Add `TableSortHead` (and `sortRows`, `nextSortDirection`) to the bundled artifact and publish.

## Decisions (auto)
- A composition over `TableHead`, not `sort` props on it: the ui wrapper stays shadcn's.
- The next direction is hidden text inside the button, not `aria-label`: the visible column name stays the start of
  the accessible name (axe `label-content-name-mismatch`).
- English defaults ("Sort descending", "Sort ascending", "Remove sorting") with a `label` prop, like every other copy
  in the package; the issue asks for app copy, which the prop gives.
- Default cycle starts with descending, as the issue proposes; two-state never returns to `none`.
- Released as a minor: new exports, no change to existing ones.

## Progress
- [ ] Phase 1: TableSortHead and sortRows (TDD)
- [ ] Phase 2: Design System artifact

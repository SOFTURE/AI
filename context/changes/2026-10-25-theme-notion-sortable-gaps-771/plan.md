# Plan: theme-notion SortableList gaps (issue #771)

## Phase 1: the new options and their tests

Files: `themes/theme-notion/src/notion/Sortable.tsx`, `src/index.ts`, `tests/notion/Sortable.test.tsx`.

1. `disabled` on `SortableList` (every row) and on `SortableItem` (one row, wins over the list). A disabled row
   renders, keeps the app's own handlers, gets `data-disabled`, and carries none of the drag attributes or listeners,
   so it does not lift by touch, mouse or keyboard and is not focusable for it. A disabled `SortableHandle` is a
   disabled button.
2. `group` on `SortableItem`: while a row is lifted, rows of another group are not droppable
   (`disabled.droppable`), so it lands only among its own group, by pointer or keyboard. `handleDragEnd` checks the
   group again before calling `onReorder`.
3. `onDragStart(id)`, `onDragEnd(id, move | null)` on every drop (null when the order did not change or the row was
   dropped outside), `onDragCancel(id)`. The list carries `data-sorting` while a row is lifted, so an app can hide
   secondary content with a class (`group-data-[sorting]:hidden`) instead of state.
4. `dragBy="activator"` + `SortableActivator`: the app's own element (a `Slot`) gets the pointer listeners with the
   row's hold; a press elsewhere in the row does not lift it. The keyboard pick-up stays on the row (focusable, as in
   `row` mode), since Space and Enter on the app's button keep their own meaning. Outside `activator` mode
   `SortableActivator` renders its child unchanged.
5. `as="ol"` (default `ul`). Children that are not `SortableItem` (an empty-state `<li>`) render in place and take no
   part in the drag.
6. Tests, one per behaviour: disabled list and row (no lift by keyboard, no tabindex, clicks reach the row), group
   (keyboard move stops at the group's edge; no `onReorder` across), callbacks (start, end with null and with the
   move, cancel), `data-sorting`, activator (row not lifted by a press on the details; activator lifts after the
   hold), `as="ol"` with a non-sortable child, and the click after a mouse drop not reaching the row.

## Phase 2: docs

Files: `themes/theme-notion/README.md`, `CHANGELOG.md` (Unreleased).

README `SortableList` paragraph and a short activator example; CHANGELOG entry with what the adopting app replaces
(its `DndContext`/`useSortable` wiring, the click grace timer, the `<ol>` wrapper).

## Phase 3: design system

Mirror the new exports in the "NOTION · Design System" artifact bundle (no visual change: the classes are unchanged).

## Decisions (auto)

- Groups as `group` on `SortableItem`, not `canDrop(activeId, overId)`: the app's need is two contiguous groups, a
  string covers it and keeps the keyboard path correct through dnd-kit's own disabled droppables.
- Keyboard pick-up in `activator` mode stays on the row, not on the activator: dnd-kit prevents Space and Enter on
  the activator, which would stop the app's button from unfolding the row from the keyboard. The row stays
  focusable as the keyboard's way to reorder; the issue's note about it is answered in the README.
- The optional click-after-drop point needs no code: dnd-kit already stops that click; a test pins it.
- `onDragEnd` gets `(id, move | null)`: two inputs, the move only when the order changed.
- No version bump: the coordinator releases in a batch.

## Progress

- [x] Phase 1: the new options and their tests (5272270)
- [x] Phase 2: docs (5272270, same commit)
- [x] Phase 3: design system (artifact version 17, no repository commit)

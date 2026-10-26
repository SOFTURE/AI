---
change_id: theme-notion-sortable-gaps-771
verdict: approved
---

# Implementation review

Reviewed commit 5272270 against plan.md and issue #771.

- Disabled: a disabled row spreads no drag attributes or listeners (no tabindex, no role description), keeps the
  app's handlers and carries `data-disabled`; the row's own `disabled` wins over the list's; a disabled row's handle
  is a disabled button. Tests cover all three and the click reaching a disabled row.
- Groups: the group travels in `useSortable({ data })`; rows of another group are not droppable while a row is
  lifted, and `getMove` checks the groups again. The keyboard test moves a row past the group's edge and gets no
  reorder and `onDragEnd(id, null)`.
- Callbacks: start, end (with the move or `null`) and cancel are each tested; `data-sorting` follows the drag.
  Omitting the native `onDragStart`/`onDragEnd` from the list's HTML props is a type change, noted in the CHANGELOG.
- Activator: pointer listeners only on the `Slot` child, keyboard on the row; a hold on the details does nothing, the
  activator's own click works. Making the row the keyboard activator outside `handle` mode also fixes a latent bug
  (Enter on a button inside a row lifted the row); the test fails without the fix (checked).
- `as="ol"` with a non-sortable `<li>`; `ref` keeps working for either element through a callback ref.
- The click after a mouse drop is swallowed by dnd-kit for 50 ms; a test pins it and the click after the grace.
- Classes unchanged; the gallery gains `SortableList[dragBy=activator]` (fixture: additions only).
- Docs: README paragraph and example, CHANGELOG Unreleased with the app's migration. Design system artifact
  updated (bundle, types, SortableList card, version 17), render-checked in light and dark.
- Gates: typecheck, ESLint, language gate green; theme-notion tests 806/806 (26 in Sortable).

Verdict: approved, no changes.

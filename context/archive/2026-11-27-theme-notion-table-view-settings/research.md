# Research: theme-notion-table-view-settings

## Findings
- `src/ui/table.tsx` is the shadcn table; nothing in the package hides columns. #1528 (sortable header) runs in
  another change and touches `TableHead`; this change adds a new file only, so the two do not overlap.
- `src/ui/popover.tsx` (`Popover`, `PopoverTrigger`, `PopoverContent` with a portal, `shadow-menu`, `rounded-xl`) and
  `src/ui/switch.tsx` (Radix switch, `role="switch"`, `aria-checked`, `disabled`) are the parts the Notion
  "Properties" panel maps to. A `DropdownMenu` with `DropdownMenuCheckboxItem` closes on every select and its roving
  focus fights a drag list, so a popover with switches fits the toggles and the optional reorder better.
- `SortableList` / `SortableItem` / `SortableHandle` (`src/notion/Sortable.tsx`): `items`, `onReorder(next, move)`,
  `dragBy="handle"`, keyboard pickup with announcements, a `label` for the list. Reusable as is for the shown columns.
- Patterns to follow: `RowActionsMenu` and `HelpTooltip` (ghost `Button size="icon"`, `ICON_STROKE_WIDTH` icon,
  English default from `messages/en.ts`, `label` prop, `max-md:size-touch-target`); `DatePicker` (a `messages` prop of
  `Partial<...Messages>` over `en.datePicker`).
- Registration a new composition needs: `src/index.ts`, README (name sentence, "Copy" list, a section),
  `tests/gallery/cases.tsx` (inventory test), `tests/fixtures/notion-slots.json` (`UPDATE_FIXTURES=1`),
  `tests/behaviour/messages.test.tsx` (every message path), the visual `gallery.png` baselines; an open overlay is an
  `isIsolated` case with its own baseline.
- Notion's "Properties" panel: a "Shown in table" group with "Hide all" at its heading, a "Hidden in table" group with
  "Show all", each row an eye toggle, the shown rows draggable.

## Risks
- A store that reads browser storage during the first render breaks hydration; the hook loads the store after mount.
- happy-dom has no layout: the tests drive the switches and buttons by click and read `aria-checked` and the callback
  arguments; the drag itself is `SortableList`'s, covered by its own tests, so the reorder test drives it by keyboard.

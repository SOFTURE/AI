# Plan: theme-notion-table-view-settings

## Approach
`src/notion/TableViewSettings.tsx`:
- `TableViewSettings({ columns, onChange, label, messages, canReorder, onReorder, align, open, defaultOpen,
  onOpenChange, className })`: a `Popover` whose trigger is a ghost icon `Button` (`SlidersHorizontal`,
  `ICON_STROKE_WIDTH`, `max-md:size-touch-target`, `aria-label`), `data-slot="table-view-settings-trigger"`. The
  content (`data-slot="table-view-settings"`, labelled by its heading) holds the title, a "Shown in table" group with
  "Hide all" and a "Hidden in table" group with "Show all" (a group only when it has columns; a bulk button only when
  it changes something). Each row (`data-slot="table-view-settings-row"`, `data-column`) is a label and a `Switch`
  bound by id; the row is the 44 px touch target below `md`. `canHide: false` disables the switch and keeps the column
  through "Hide all". `onChange(nextVisibleIds)` gets the visible ids in the columns' order.
- With `canReorder`, the shown group is a `SortableList dragBy="handle"` with a `SortableHandle` per row;
  `onReorder(nextOrder)` gets every column id: the shown ones in their new order, the hidden ones in their slots.
- `applyColumnVisibility(definitions, visibleIds, order?)`: the definitions that are visible, in `order` (unknown ids
  after, in their own order). Pure.
- `useTableColumns({ columns, store })`: the state `{ visible, order }`, loaded from `store.load()` after mount and
  merged with the definitions (unknown ids dropped, new columns added with `isVisibleByDefault`, `canHide: false`
  always visible), saved by `store.save()` on every change. Returns `columns` (for the menu), `visibleIds`, `order`,
  `setVisibleIds`, `setOrder`, `reset`.
- Copy `tableViewSettings: { trigger, title, shown, hidden, showAll, hideAll, reorder }` in `messages/en.ts`.

## Phases
### Phase 1: TableViewSettings, helper and hook (TDD)
- Tests first in `tests/notion/TableViewSettings.test.tsx`: trigger markup (name, ghost, touch class, slot); open
  shows the title, shown then hidden rows with `data-column`; a switch calls `onChange` with the ids in column order;
  a `canHide: false` switch is disabled and stays through "Hide all"; "Show all" shows every column; bulk buttons only
  when they change something; reorder off by default, on renders handles and keyboard reorder calls `onReorder` with
  hidden slots kept; `applyColumnVisibility` cases (empty, unknown ids, order); `useTableColumns` defaults, store load
  after mount with merge, save on change, reset.
- Code, export, messages and their test entries, gallery cases, fixture, README, CHANGELOG `## Unreleased`, visual
  baselines.
- Done when: `npx vitest run themes/theme-notion` passes; typecheck, lint and build pass; baselines updated.

### Phase 2: Design System artifact
- Add `TableViewSettings` to the bundled artifact and publish.

## Decisions (auto)
- A `Popover` with switches rather than a `DropdownMenu`: toggles keep it open and the drag list keeps its own
  keyboard; Tab moves between switches, Space toggles, Escape closes and focus returns to the button.
- Groups and bulk actions as in Notion: "Hide all" at the shown group, "Show all" at the hidden group.
- Reorder only among the shown columns; hidden columns keep their slots.
- The hook loads the store after mount (SSR-safe) and has no built-in storage: the app decides.
- Released as a minor: new exports, no change to existing ones.

## Progress
- [x] Phase 1: TableViewSettings, helper and hook (TDD) (`npx vitest run themes/theme-notion` 75 files, 1502 tests passed, 16 new in `tests/notion/TableViewSettings.test.tsx`; fixture by `UPDATE_FIXTURES=1`; `gallery.png` baselines regenerated and `TableViewSettingsOpen.png` added in Chromium 1243, axe clean; a Chromium check of the open case at 390 px dark showed the sortable rows on the popover's own background after `bg-transparent`; typecheck, lint and build green)
- [x] Phase 2: Design System artifact (version 113-114: a `TableViewSettings` IIFE appended to `bundle.js` (N.Popover/Switch/Button/SortableList, the sliders icon drawn inline from lucide's paths) with `applyColumnVisibility` and `useTableColumns`, header `{"name":"TableViewSettings"}`, 9 rules appended to `bundle.css` as a trailing `@layer utilities{}` (diffed with postcss against the gallery css, `max-md:min-h-touch-target` repeated after `min-h-8` to keep the package's order), types in `index.d.ts`, a new TableViewSettings card and a note on the Table card, `lastChange` in the index; checked with `node vm.Script` and in Chromium with no console error: a click on a row's name hides its column in the preview table, the always-shown switch is disabled, rows 32 px at 1280 px and 44 px at 390 px)

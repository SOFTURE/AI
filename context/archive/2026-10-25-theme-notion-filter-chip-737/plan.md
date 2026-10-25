# Plan: theme-notion FilterChip (issue #737)

## Phase 1: FilterChip and FilterChipAdd

Files: `themes/theme-notion/src/notion/FilterChip.tsx`, `src/index.ts`, `src/messages/en.ts`,
`tests/notion/FilterChip.test.tsx`, `README.md`, `CHANGELOG.md` (Unreleased).

1. `FilterChip` with the issue's props: a Radix menu whose trigger is the pill (`data-slot="filter-chip"`,
   `data-active` only when active) and whose content (aligned to the start) holds the children.
2. `FilterChipAdd` (`label` default `notionMessages.en.filterChip.add` = "Add filter", `children`, `className`), the
   same pill with a plus icon and `data-slot="filter-chip-add"`.
3. Export both and their props types from the root.
4. Tests: label and value rendered, `data-active` and the blue tag only when active, a button with
   `aria-haspopup="menu"`, the menu opens on pointer down and on Enter with the children inside, the add pill's
   default and replaced label, root export.
5. README component list and CHANGELOG entry.

## Decisions (auto)

- A menu, not a listbox: the children are `DropdownMenu` items (radio items for one choice), which Radix makes
  keyboard-operable. A `Command` list can sit inside a menu item group too; a Popover variant can come later.
- No `open` / `onOpenChange` props: not asked for; an optional addition later is not a break.
- `data-active` is present (empty) only when active, styled with `data-[active]:`.
- No version bump: the coordinator releases in a batch.

## Progress

- [x] Phase 1: FilterChip and FilterChipAdd (8224090)

# Research: theme-notion FilterChip (issue #737)

## Current state (master e6d049c)

- Compositions live in `themes/theme-notion/src/notion/` and are exported by name from `src/index.ts`; `src/ui/` is
  the shadcn set (its file count is pinned by `tests/index.test.ts`).
- `src/ui/dropdown-menu.tsx` wraps Radix `DropdownMenu`. `DropdownMenuTrigger` renders a `<button type="button">` with
  `aria-haspopup="menu"`, `aria-expanded` and `data-state`, and opens on pointer down or Enter, Space, ArrowDown.
  `DropdownMenuContent` already draws the design system's popover (`rounded-xl`, `bg-popover`, `shadow-menu`) in a
  portal; its `data-slot` comes before the spread props, so a caller's `data-slot` wins.
- Tokens: `bg-blue-tag`, `text-blue-tag-foreground` (palette tags), `bg-accent`, `text-muted-foreground`, `ring-ring`
  all exist in `NOTION_THEME`; `./notion` is already a Tailwind source of `theme.css`.
- Built-in copy lives in `src/messages/en.ts`, each text replaceable by a prop (`SidePanel.closeLabel`).
- Radix menus open in happy-dom tests through `fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false })` or
  `keyDown` Enter.

## Findings

- `FilterChip` = `DropdownMenu` + a styled `DropdownMenuTrigger` + `DropdownMenuContent align="start"` holding the
  children. A menu (not a listbox) matches the issue's "DropdownMenu items" children and gives keyboard support.
- `FilterChipAdd` reuses the same trigger look without the active state, with a plus icon and the label "Add filter"
  from the messages, replaceable by a prop.

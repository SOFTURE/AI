---
change_id: theme-notion-touch-sizes-880
status: archived
---

# Plan: touch sizes for menus, tabs, accordion and dialog close (issue #880)

Input: change.md, research.md. Complexity: small (four components, their tests, docs, fixtures).

## Phase 1: sizes (TDD)

Files: `themes/theme-notion/src/ui/dropdown-menu.tsx`, `src/ui/tabs.tsx`, `src/ui/accordion.tsx`,
`src/ui/dialog.tsx`, `tests/ui/*.test.tsx` (new tests), `tests/upstream/deltas.ts`, `tests/gallery/cases.tsx`,
`tests/fixtures/notion-slots.json`.

- DropdownMenu: `DropdownMenuContent size?: "default" | "touch"` through a context; `DropdownMenuItem`,
  `DropdownMenuCheckboxItem`, `DropdownMenuRadioItem` and `DropdownMenuSubTrigger` take `size` (own wins) and draw
  `min-h-touch-target` instead of `min-h-7`.
- Tabs: `tabsListVariants` gains `size` (`default`: nothing, `touch`: `group-data-[orientation=horizontal]/tabs:h-auto`);
  `TabsList size` through a context; `TabsTrigger size` (own wins) adds `min-h-touch-target min-w-touch-target`.
- Accordion: `AccordionTrigger size?: "default" | "touch"`, `touch` adds `min-h-touch-target`.
- Dialog: `DialogContent closeButtonSize?: "default" | "touch"`; `touch` draws the close button 44 × 44 centred on the
  icon (`top-0.5 right-0.5 inline-flex size-touch-target items-center justify-center`).
- Every component sets `data-size` only when it already did (none of these did): no new attributes on defaults.
- Tests: each touch size's classes, a caller's `md:` class kept, list size reaching items and an item overriding it,
  defaults unchanged.
- Gallery: touch cases for the menu, tabs, accordion and dialog; regenerate the fixture; deltas list the changed lines.

## Phase 2: docs

`themes/theme-notion/README.md` (the touch sizes paragraph), `CHANGELOG.md` `## Unreleased`.

## Decisions (auto)

- `DropdownMenuSubTrigger` gets the size too: a sub-menu row in a touch menu is tapped like any item.
- Dialog close opts in by prop (`closeButtonSize="touch"`), not by breakpoint: defaults stay unchanged as the issue asks.
- `TabsTrigger` gets `min-w-touch-target` as well: icon-only tabs would stay narrow otherwise.
- No version bump: the coordinator releases the batch.

## Progress

- [x] Phase 1: sizes, 8c354cd
- [x] Phase 2: docs, 3d7c355 (baselines 709d8da)
- [x] Implementation review: approved

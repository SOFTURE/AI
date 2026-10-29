---
change_id: theme-notion-sheet-menu-858
status: open
---

# Plan: menu rows for a side Sheet (issue #858)

Input: change.md, research.md. Complexity: small (one new composition file, its tests, gallery case, docs).

## Phase 1: SheetMenu, SheetMenuItem, SheetMenuButton (TDD)

Files: `themes/theme-notion/src/notion/SheetMenu.tsx`, `src/index.ts`, `tests/notion/SheetMenu.test.tsx`,
`tests/gallery/cases.tsx`, `tests/fixtures/notion-slots.json`.

- `SheetMenu`: `ul` `data-slot="sheet-menu"`, `flex w-full min-w-0 flex-col gap-1`.
- `SheetMenuItem`: `li` `data-slot="sheet-menu-item"`.
- `SheetMenuButton`: `button` (or the child with `asChild`), `data-slot="sheet-menu-button"`, `data-active` from
  `isActive`; `flex w-full min-h-touch-target md:min-h-row-height items-center gap-2 rounded-md px-2 text-left
  text-ui text-foreground`, `hover:bg-accent`, `active:bg-accent`, `focus-visible:ring-2 ring-ring`, active row
  `bg-accent font-medium`, `disabled` / `aria-disabled` at 50 % without pointer events, icons 16 px with
  `ICON_STROKE_WIDTH`, the last span truncated. `type="button"` by default on a plain button.
- Tests: the three slots and the list semantics, no provider needed, `isActive`, `disabled`, `asChild` link, inside
  `SheetClose asChild` the click closes the sheet.
- Gallery case `SheetMenu` (the full drawer recipe), fixture regenerated with `UPDATE_FIXTURES=1`.

## Phase 2: docs

`themes/theme-notion/README.md` (composition list and a `SheetMenu` section with the drawer recipe: heading with a
ghost close button, rows, a `SheetFooter` with `border-t`), `CHANGELOG.md` `## Unreleased`.

## Phase 3: design system artifact

NOTION · Design System: a `SheetMenu` card (README + preview) and the three parts in the bundle, `index.d.ts`.

## Decisions (auto)

- Three parts mirroring the sidebar instead of the issue's two: `SheetClose asChild` and `asChild` links need the row
  apart from the `li`.
- Hover colour `accent`, not `sidebar-accent`: the sheet is on `background`.
- The heading and the foot stay a recipe (existing `SheetHeader`, `SheetClose`, ghost `Button`, `SheetFooter`), as
  the issue asks; no new heading component.
- No version bump: the coordinator releases (theme-notion minor, nothing depends on it).

## Progress

- [x] Phase 1: SheetMenu parts, 3aa3f6b
- [ ] Phase 2: docs
- [ ] Phase 3: design system artifact

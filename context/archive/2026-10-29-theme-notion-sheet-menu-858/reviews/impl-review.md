---
change_id: theme-notion-sheet-menu-858
verdict: approved
---

# Implementation review

Reviewed the diff against plan.md and issue #858.

- `SheetMenu` (`ul`), `SheetMenuItem` (`li`), `SheetMenuButton` (row, `asChild`, `isActive`) in
  `src/notion/SheetMenu.tsx`, exported from the root. No `useSidebar()`, so they work in any `Sheet`.
- Row classes as the issue asks: full width, left-aligned, `text-ui text-foreground`, `min-h-touch-target
  md:min-h-row-height`, `accent` hover, press and active state, `ring` focus, `disabled` and `aria-disabled` at 50 %
  without pointer events. `type="button"` by default on a plain button, none on an `asChild` link.
- Tests (`tests/notion/SheetMenu.test.tsx`): list semantics without a provider, the touch and row heights, active,
  disabled, `asChild` link with `aria-current`, `SheetClose asChild` closes the sheet. Gallery case `SheetMenu` draws
  the full drawer recipe; the parity fixture gained only that entry; the inventory and tailwind-classes tests pass.
- Docs: README composition list and a `SheetMenu` section with the drawer recipe and the migration from ghost
  `Button`s; CHANGELOG `## Unreleased`.
- Design system artifact NOTION · Design System versions 36-37: `SheetMenu` card (README, preview), the three parts
  appended to `bundle.js` (plus `Icons.X` for the close button), `bundle.css` rebuilt over the published class set
  (only additions: `active:bg-accent`, `data-[active=true]:bg-accent`, the preview's `min-h-[540px]`), `index.d.ts`.
  Rendered with Playwright in light and dark: rows 44 px on a phone, 34 px from `md`, no console errors.
- Gates: typecheck and lint (pre-commit), theme-notion tests 875 passed; `npm test` runs on pre-push.

Verdict: approved, no changes.

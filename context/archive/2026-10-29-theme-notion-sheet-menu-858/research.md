---
change_id: theme-notion-sheet-menu-858
---

# Research: menu rows for a side Sheet (issue #858)

## What exists

- `src/ui/sheet.tsx`: shadcn `Sheet` with the theme's deltas (`closeLabel`, safe-area insets from #851).
  `SheetContent` is a `flex flex-col gap-4` column; `SheetHeader` `flex flex-col gap-1.5 p-4`; `SheetFooter`
  `mt-auto flex flex-col gap-2 p-4`, so a footer already sits at the panel's foot. `showCloseButton={false}` drops
  the built-in 16 px close icon, so an app can put its own ghost `Button` in the heading.
- `src/ui/sidebar.tsx`: `SidebarMenu` (`ul`), `SidebarMenuItem` (`li`), `SidebarMenuButton` (cva, `asChild`,
  `isActive` → `data-active`, `sidebar-accent` hover). The button calls `useSidebar()` for its tooltip, which throws
  outside a `SidebarProvider`. The `sidebar-*` colours belong to the sidebar's own surface; a sheet sits on
  `background`, where the hover colour is `accent` (as in `FoldRow`, `PropertyList`, `Stats`).
- Tokens: `touch-target` 44 px and `row-height` 34 px (sizes), `text-ui` 14/20 (text style). Both used by the app's
  workaround (`min-h-touch-target`, `text-ui text-foreground`).
- `tests/upstream.test.ts` pins every `src/ui` file to upstream shadcn plus listed deltas, so new components in
  `sheet.tsx` would be invented deltas. `src/notion/` holds the theme's own compositions; `tests/inventory.test.ts`
  requires each one named in the README, exported from the root and drawn in the gallery
  (`tests/gallery/cases.tsx`), and `tests/parity.test.tsx` pins the gallery's slot classes in
  `tests/fixtures/notion-slots.json`.

## Options

1. `SheetMenu` (`ul`), `SheetMenuItem` (`li`) and `SheetMenuButton` (the row; `asChild`, `isActive`) in
   `src/notion/SheetMenu.tsx`, mirroring the sidebar's three parts. The row can be wrapped by `SheetClose asChild`
   (closes the sheet) and can render a `Link` through `asChild`. Chosen.
2. A two-part `SheetMenu` / `SheetMenuItem` where the item is both `li` and button: `SheetClose asChild` and a link
   would then land on the `li`. Rejected.
3. Make `SidebarMenuButton` work without a provider: an upstream delta in `sidebar.tsx` and `sidebar-*` colours on a
   `background` surface. Rejected.

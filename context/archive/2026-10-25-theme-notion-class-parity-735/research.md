---
change_id: theme-notion-class-parity-735
status: done
---

# Research

- `themes/theme-notion/src/ui/sidebar.tsx`: the `collapsible === "none"` root (line 178) has the gap's classes, the
  mobile `SheetContent` (line 195) has the `none` root's classes, and `sidebar-gap` (line 226) has the panel's. Stock
  new-york v4 and the design system: `none` root `flex h-full w-(--sidebar-width) flex-col bg-sidebar
  text-sidebar-foreground`; sheet `w-(--sidebar-width) bg-sidebar p-0 text-sidebar-foreground [&>button]:hidden`;
  gap `relative w-(--sidebar-width) bg-transparent transition-[width] duration-200 ease-linear` followed by the
  existing `group-data-*` lines.
- `sheet.tsx` renders its close button as a direct `SheetPrimitive.Close` child of the content, so
  `[&>button]:hidden` hides it in the phone sidebar (the sidebar has its own trigger).
- `checkbox.tsx`: `CheckIcon` repeats the indicator's classes; expected `size-3.5`.
- `select.tsx`: `ChevronUpIcon` inside `SelectScrollUpButton` repeats the button's classes; expected `size-4` (the
  down button's icon already has it). `SelectItem` lacks `[&_svg:not([class*='text-'])]:text-muted-foreground`.
- `field.tsx`: `FieldTitle` repeats `FieldLabel`'s first line; expected `flex w-fit items-center gap-2 text-sm
  leading-snug font-medium group-data-[disabled=true]/field:opacity-50`.
- Tests: `tests/ui/*.test.tsx` render with `renderToStaticMarkup`; portal content (the phone sheet, select content)
  needs a DOM: `SidePanel.test.tsx` uses `// @vitest-environment happy-dom` and `@testing-library/react`; the kit's
  `use-is-mobile.test.tsx` mocks `window.matchMedia` to force the phone width.
- Base rules: the kit's `base.css` styles `body` with contract tokens only (no font size, no selection colour). The
  design system's `globals.css` base layer adds `body` `text-sm`, `::selection { background: var(--blue-tag) }` and
  `html { -webkit-font-smoothing: antialiased }`. `blue-tag` is a Notion colour (`src/tokens.ts`), not a contract
  role, so the rules belong in theme-notion. A plain stylesheet in `src/` is declared in `softureTheme.stylesheets`,
  copied to `dist/` by `softure-theme-css` and must be exported (`tests/repo/themes.test.ts`).
- `--text-sm` and `--text-sm--line-height` come from `tailwindcss/theme.css`, imported in both README wirings, so
  `--theme(--text-sm)` resolves; `tests/theme-css.test.ts` compiles stylesheets with the real Tailwind CLI.

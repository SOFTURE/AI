---
change_id: theme-notion-side-panel
---

# Research

- Compositions live in `themes/theme-notion/src/notion/` (`PageHeader`, `Status`, ...), exported by name from
  `src/index.ts`. `softureTheme.sources` in `package.json` lists `./notion`, so `theme.css` makes Tailwind see the
  new file's classes without app config.
- Classes the reference uses exist in the theme: `shadow-menu` (tokens `shadows.menu`), `text-heading-3`,
  `border-border`, `bg-background`, `ring-ring`; `z-3` is a stock Tailwind v4 numeric utility.
- `Button` (`ghost`, `icon`) and `ICON_STROKE_WIDTH` are in the package; `X` comes from `lucide-react` (dependency).
- Built-in copy: `src/messages/en.ts` holds accessible names with props to replace them (`sheet.close` +
  `SheetContent closeLabel`). The same pattern fits `closeLabel` here.
- Tests in the package render with `renderToStaticMarkup`; focus and key behaviour needs a DOM. The repository
  already runs `happy-dom` + `@testing-library/react` per file (`// @vitest-environment happy-dom`, e.g.
  `foundation/ui/tests/modal.test.tsx`), both root devDependencies.
- `tests/index.test.ts` checks every barrel export is defined; README lists compositions and the copy props.

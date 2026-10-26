---
change_id: theme-flat-paint-table-shot-784
status: in_progress
---

# Research: DataTable look and shot frame (issue #784)

## R1. What the package has

- Tokens: `shadows.selected-row` (`inset 3px 0 0` lime) and `shadows.shot-frame` (`0 0 0 1px` paper-line), so
  `shadow-selected-row` / `shadow-shot-frame` utilities and `--shadow-*` scheme variables exist (theme-kit
  `buildThemeCss`). `radii.card` 12 px (`--radius-card` in `@theme inline`, read in `page.css` with `--theme()`),
  `sizes.touch` 44 px (`h-touch`), text style `caption` 12 px / 400.
- `page.css` holds the page-level classes (`tabular`, `figure`, `num`, `card-surface`); look maps live in `src/look/`,
  which `softureTheme.sources` hands to the app's Tailwind, so their classes are generated without an app source.
- `cn` knows the theme's text styles and shadows, so `cn(row, selectedRow)` lets the later background win.

## R2. Table rendering details

- Tailwind's preflight sets `border-collapse: collapse` on tables; collapsed borders do not travel with a
  `position: sticky` cell, so the sticky column's hairline is an inset box shadow, not a border.
- A sticky cell needs an opaque background; `bg-inherit` takes the row's, so a selected row keeps `surface-raised`
  under the stuck cell. Hence the row paints `bg-surface`.
- `last:` on the amount cell bolds the last column; the selected row bolds its first cell (the year, the row header)
  with `[&>:first-child]:font-bold`.

## R3. Shot frame

`img` default is inline; the issue lists `display: block; width: 100%`, `radius-card`, the shot-frame shadow,
`object-fit: cover; object-position: top`, `paper` background. Aspect ratio stays the app's.

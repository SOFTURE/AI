---
change_id: theme-flat-paint-chart-look
---

# Research

## R1: the charts primitives (`foundation/charts` 0.5.1)

- `ChartFlag`: `variant` `flag | ink | outline`, `size` `sm | md`, `className` added after the package classes.
  `.sft-chart-flag` already sets `white-space: nowrap`, weight 700 and tabular numbers; background
  `--sft-chart-flag`, text `--sft-chart-on-flag`.
- `ChartPin`: `variant` `flag | ink`, `size` `sm | md | lg`, `ring` `axis | surface`, `classNames.{line,dot}`.
  The dot has a 2 px ring in `--sft-chart-axis`, sized by `--sft-chart-dot-size` (`sm` 0.8x, `lg` 1.25x).
- The pin line is **not a border**: `.sft-chart-pin-line` is a one-pixel `repeating-linear-gradient` in
  `var(--sft-chart-pin-line, var(--sft-chart-cursor))`. A `border-l border-dashed` class (the adopting app's
  current classes) draws a second dash next to the package's. Setting `--sft-chart-pin-line` on the line colours
  the package's own dash.
- `ChartSurfaceName` is `page | dark | paper`; `ChartToneName` covers `accent`, `muted`, `success`, `warning`,
  `danger` among others.

## R2: the theme

- Colours `accent-fill`, `on-accent`, `lime`, `lime-deep`, `paper`, `ink`, `foreground` exist as utilities; the
  radius token `flag` (4 px, the design system's `radius-flag`) gives `rounded-flag`.
- The bridge points `--sft-chart-axis` at `muted`; there is no `chart-axis` colour utility in the theme, so the
  issue's `border-chart-axis/60` would generate nothing from the theme alone.
- `tests/contrast.test.ts` measures token pairs by name; `paper` on `lime-deep` is a new text pair.
- `tests/theme-css.test.ts` compiles `theme.css` with the Tailwind CLI and checks look-map classes are generated.

# Research: ChartFlag drops style on a free flag (issue #711)

## Current state (master 9deab4b)

- `foundation/charts/src/svg/flag.tsx`: `inline` is
  `isPlaced ? { left, ...rowStyle, ...spanStyle, ...style } : spanStyle && { ...spanStyle, ...style }`.
  With `rows === 1` `spanStyle` is `undefined`, so a free flag gets `style={undefined}` and the caller's style is lost.
- Tests of the flag's markup: `foundation/charts/tests/flag-span-592.test.tsx` (`renderToStaticMarkup`, exact
  strings). A free flag of one row with no style renders `<span class="sft-chart-flag sft-chart-flag-free">` with no
  style attribute; React omits `style` for `undefined` and also for an empty object.

## Findings

- `{ ...spanStyle, ...style }` for a free flag fixes the drop. React renders no `style` attribute for `{}`, so the
  markup of a free flag without style stays the same.

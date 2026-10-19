---
change_id: charts-flag-row-span-592
status: done
---

# Research: flags spanning several rows (issue #592)

- `foundation/charts/src/svg/flag-layout.ts`: `layoutFlags` sorts flags by start, end, input order and keeps one
  `rowEnds[row]` per row; a flag takes the first row whose end plus `gap` is at most its start, else a new row while
  under `maxRows`, else it is hidden. Spanning rows needs the check over every row `row … row + rows - 1`, rows past
  the current count being free. Because a flag takes the lowest row it fits and spans contiguous rows, `rowEnds`
  never gets holes.
- `rowEnds` holds the latest end in each row. That stays a correct "row is free from here on" bound: flags come in
  start order, so every earlier chip in a row starts no later than the current one.
- `foundation/charts/src/svg/flag.tsx` + `styles.css` (`.sft-chart-flag-stacked`): `translate: 0 calc(row * (100% +
  space-1))`, where `100%` is the chip's own height. A chip as tall as `n` rows (`n * h + (n - 1) * space-1`) needs
  `row * (100% + space-1) / n`, which equals `row * (h + space-1)` once the chip is exactly that tall.
- One row's height is the chip's line box plus its vertical padding (`space-1`, 0 for `size="sm"`), plus the border
  on `outline`. CSS can express it with the `lh` unit (`1lh`, the chip's own line height), so a spanning chip gets
  `min-height: calc(n * (1lh + 2 * pad) + (n - 1) * space-1)` with `box-sizing: border-box`. `lh` is in every
  evergreen browser (Chrome 109, Safari 16.4, Firefox 120). The outline border makes a one-row outline chip a border
  taller than this unit; spanning outline chips are not a case anyone draws (the "+N" chip is one row).
- Tests: `foundation/charts/tests/flag-layout-559.test.ts` (hand oracles, a random no-overlap property) and
  `flag-stack-559.test.tsx` (`renderToStaticMarkup` of `ChartFlag`). They pin today's output and must stay green.
- Docs: `foundation/charts/README.md` "Stacked flags", `CHANGELOG.md` (top is `## 0.4.0`, published).

# Research: theme-notion-side-layout-inline

## Findings
- `themes/theme-notion/src/notion/List.tsx`, `ListEntry`: `list-entry-side` (`flex flex-nowrap items-start`, `ml-auto`)
  holds `list-entry-column` (`flex flex-col items-end gap-1`, with `has-[[data-row-wide]]:flex-1 items-stretch`) and the
  arrow of a linked row. The column holds `list-entry-status` (badges, `flex-wrap justify-end`) over
  `list-entry-actions` (the inline control and the `list-entry-menu`, 44 px targets below `md`).
- A `data-row-wide` control makes the side take the full basis (`has-[[data-row-wide]]:basis-full`) and the column
  stretch; the status then starts on the left (`group-has-[[data-row-wide]]/list-entry-side:justify-start`).
- On a phone the identity takes the full basis (`max-md:basis-full`), so the side wraps under it, kept right by
  `ml-auto`.
- `themes/theme-notion/src/notion/FoldRow.tsx`: with a status or actions, `fold-row-actions` is a row below `md`
  (`flex flex-wrap items-center gap-2 pl-8`, under the summary) and a column from `md` up (`md:flex-col md:items-end`,
  `md:justify-center` or `md:justify-start` by `align`), the status (`fold-row-status`) over `fold-row-action-list`.
- A `ResultBadge` is 22 px high, an `icon-sm` button 28 px; centred on one row they share a middle.
- Checks today: `tests/notion/List.test.tsx` and `tests/notion/FoldRow.test.tsx` assert the slot classes;
  `visual/fit.spec.ts` measures the stacked geometry (badge over the controls); `tests/parity.test.tsx` compares the
  slots with the `notion-slots.json` fixture; the gallery takes a screenshot per case (desktop 1440 px and phone 390 px,
  light and dark).
- The Design System artifact carries `ListEntry` and `FoldRow` in its `bundle.js`; it has to follow.

## Options
1. A `sideLayout: "stack" | "inline"` prop, `stack` by default. No layout moves for apps that do not ask.
2. `inline` as the new default. Every adopting row with a status and controls changes at once, which needs each app's
   review; a breaking visual change for a minor release.

Recommendation: option 1.

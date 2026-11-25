# Research: theme-notion-fold-row-action-column

## Question
How can the actions column, which must stay outside the `<summary>`, be exactly as high as the summary, with CSS only
(`FoldRow` is a server component with no client state)?

## Findings
- `themes/theme-notion/src/notion/FoldRow.tsx`: with actions, a flex wrapper holds the `<details>` (summary and opened
  content) and the actions `<div>`. The actions can only stretch to the whole `<details>`, which includes the opened
  content, so today they are pinned to `min-h-row-height` at the top.
- An element outside the summary cannot size itself to it while the opened content shares the summary's box:
  `display: contents` and `::details-content` on `<details>` are not supported across the browsers the theme targets,
  and anchor positioning is not either.
- When the `<details>` holds only its `<summary>`, its box is the summary's box. The opened content can then be a
  sibling shown by `peer-open` (CSS only, as the actions' background already is). In a grid with the details and the
  actions in one row and the content in the next, the actions stretch to the row, that is to the summary.
- Trade-off: content outside the `<details>` is not revealed by the browser's find-in-page on a closed row. It is
  `display: none` while closed, so assistive technology skips it as before; the summary keeps its native
  expanded/collapsed state. Rows without actions keep the content inside the `<details>`.
- The theme's phone breakpoint for touch sizes is `md` (`SheetMenu`: `min-h-touch-target md:min-h-row-height`); the
  `touch-target` spacing token is 44 px. Tailwind 4.3 generates `*:` and `max-md:` variants.
- Consumers in the repository: the component's tests, the gallery cases, the parity fixture and the visual baselines.

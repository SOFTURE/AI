# Research: theme-notion-fold-row-align-start

## Findings
- `src/notion/FoldRow.tsx`: the `<summary>` is `flex flex-wrap items-center`; the app's `summary` node sits in
  `fold-row-summary-slot`, also `items-center`; the fixed summary's heading (`fold-row-heading`) puts the chevron and
  the title in `flex items-center`. On a multi-line summary every one of them centres the chevron vertically.
- The right column (`fold-row-actions`) spans the summary's full height (a grid row) and is `md:flex-col
  md:items-end md:justify-center md:py-1`, so its content sits in the middle of the bar. Its top padding (4 px)
  equals the summary's (`py-1`), so `md:justify-start` puts the status's top on the summary's first line.
- The summary text uses the `ui` type style (14 px / 20 px line). The chevron is 16 px. Wrapping it in a box one line
  of `ui` text high (`text-ui h-lh`, Tailwind's `1lh` height) centred on its content puts the chevron in the middle
  of the first line whatever the summary below it holds; Tailwind 4.3 in the repository emits `h-lh` as `height: 1lh`.
- Below `md` the column falls under the summary as a wrapping row; alignment there is unchanged.
- Existing tests in `tests/notion/FoldRow.test.tsx` assert the summary's and the column's classes exactly, so the
  default (`center`) must keep every class as it is.

## Risks
- A summary whose first line is not `ui` text (a larger heading) would put the chevron slightly high; the default
  stays `center`, and the README says `start` lines up with a `ui` first line.

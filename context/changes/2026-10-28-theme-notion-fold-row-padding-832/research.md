---
change_id: theme-notion-fold-row-padding-832
---

# Research

## What exists

- `themes/theme-notion/src/notion/FoldRow.tsx`: a native `<details>`; the `<summary>` holds the chevron and title
  (`fold-row-heading`), facts (`fold-row-fact`) and badges (`fold-row-badges`) and has `px-1`. The content is
  `<div data-slot="fold-row-content" className="flex flex-col gap-2 py-2 pr-1 pl-6 empty:hidden">` with a
  `DetailTable` (renders nothing when no row has a value) and `children`.
- `title`, `badges`, `detailsLabel` and `details` are required props.
- `tests/notion/FoldRow.test.tsx` pins the slot order and texts; `tests/gallery/cases.tsx` renders one gallery case.
- `StatsFold` (`src/notion/Stats.tsx`) has the same one-sided padding (`pt-2 pb-1 pl-6`); #831 handles it with the same
  `isInset` prop in a parallel change, so the two must agree on the name and the default.
- No other source in the repository references `fold-row-content`.

## Findings

- Equal padding: `p-3` (12 px) matches the table's own cell rhythm (`py-1.5`, `pr-3`) and the issue's example.
- `pl-6` (24 px) lines the content up with the title after the 16 px chevron, 8 px gap and the summary's 4 px padding;
  that is the indented look `isInset` keeps.
- A `summary` slot has to keep the chevron (the row's affordance) and the summary's hover and focus styles, so the
  slot replaces only what follows the chevron.
- Making `title`/`badges` and `detailsLabel`/`details` optional fits the conventions best as discriminated unions:
  either the fixed summary or the slot; either a labelled table or none.

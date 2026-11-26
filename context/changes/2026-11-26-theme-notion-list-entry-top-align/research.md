# Research: theme-notion-list-entry-top-align

## Findings
- `themes/theme-notion/src/notion/List.tsx`: the `list-entry` root is `flex flex-wrap items-center`; the identity is a
  `flex-col` and `list-entry-side` (`flex flex-nowrap items-center`) holds the column (`flex-col items-end`, status over
  actions) and the arrow. With a three-line identity the side is centred against it: in the gallery case (title and
  two detail lines) the badge's middle is 7 px below the title line's middle at the desktop viewports, more with more
  lines (the issue measures 6 to 58 px in an adopting app).
- The title is `text-ui-medium`: 14 px on a 20 px line. A `ResultBadge` is 22 px tall (12 px text, `py-0.5`, a 1 px
  border), so a top-aligned badge's middle is 1 px from the title line's middle.
- The arrow is a 16 px icon in a plain `flex` span; inside a top-aligned side it would sit at the top, 2 px above the
  line's middle. A 20 px tall box (`h-5`, the title's line) centring the icon keeps it on the line.
- On a phone the identity takes the full basis (`max-md:basis-full`), so the side wraps under it; the root's cross
  alignment does not change that layout.
- Existing checks: `tests/notion/List.test.tsx` asserts `items-center` on the root; `visual/fit.spec.ts` checks the
  geometry of the entry (badge over the controls, arrow within the column's height), which top alignment keeps.
- Single-line rows: the title line and a badge differ by 2 px, so a row with a status looks as before; a row with
  only a 28 px control now aligns that control's top with the title's (4 px of difference in the middles).

## Options
1. `items-start` on the root and the side, arrow `h-5 items-center` (the issue's proposal). Small, no new API.
2. An `align: "start" | "center"` prop with `start` as the default. More API for a 4 px difference on single-line
   rows that nobody asked to keep.

Recommendation: option 1.

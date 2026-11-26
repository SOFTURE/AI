# Research: theme-notion-list-entry-arrow-middle

## Findings
- `themes/theme-notion/src/notion/List.tsx`: `list-entry-side` is `flex flex-nowrap items-start gap-2` and holds the
  column (`list-entry-column`) and the arrow (`list-entry-arrow`, `flex h-5 items-center`). The side's own place in the
  row is set by the root (`items-start`, #1497); the side's `align-items` only places the column and the arrow
  against each other.
- `Button size="icon-sm"` is 28 px (`size-7`) on a desktop; below `md` the actions slot gives every control
  `min-h-touch-target` (44 px). With `items-start` the 20 px arrow box sits at the top: its middle is 4 px (desktop)
  to 12 px (phone) above the control's middle.
- With the stacked layout (status over controls, the default `sideLayout`) the column is two lines; #1497's geometry
  test (`visual/fit.spec.ts`) requires the arrow on the badge's (the title's) line there. Centring the side for every
  row would move the arrow between the badge and the controls and break that requirement.
- Single-line column cases: a status only (the badge is 20 px, so centring and top alignment agree), controls only
  (the issue's case), and `sideLayout="inline"` (status and controls on one line).
- `data-row-wide` makes the side take the full row; its column stretches and the top alignment should stay.
- The gallery has no linked row with controls and no status, so neither the unit test nor the browser test covers
  the issue's case today.

## Options
1. The issue's proposal: `items-center` on the side unless a control is `data-row-wide`. Breaks #1497's arrow on the
   status line in the stacked layout.
2. `items-center` when the column is one line (no status, or no controls, or `sideLayout="inline"`), `items-start`
   when a status stands over controls; `has-[[data-row-wide]]:items-start` either way. Decided at render from the
   props `ListEntry` already reads; no new API.

Recommendation: option 2.

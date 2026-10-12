---
change_id: charts-adoption-gaps-409
status: implementing
---

# Plan: charts adoption gaps (issue #409)

Input: change.md, research.md. Complexity: medium (four additive helpers and one new client component, one test file,
docs).

## Phase 1: data helpers and stacked areas (TDD)

Files: new `foundation/charts/src/scale/step.ts`, `src/palette/distinct-colors.ts`, `src/scale/stack.ts`,
`src/svg/stacked-areas.tsx`; `src/index.ts`; test `foundation/charts/tests/adoption-gaps-409.test.tsx`.

1. Tests first, red on master:
   - `withStepAt(points, i)` inserts `{ ...points[i], y: points[i - 1].y }` before `i`; index 0, negative or past the
     end returns an unchanged copy; `linePath` of the result has a vertical segment.
   - `distinctColors(keys)` gives slots 1..6, distinct for up to six keys, the same map for any key order, keeps a
     key's colour when another joins (unless it collided), ignores duplicate keys, wraps past the palette; with an app
     palette it returns its values; an empty palette throws.
   - `stackSeries` stacks positive values up and negative ones down per index, keeps each series' look, and throws for
     series of different lengths or x values.
   - `StackedAreas` renders one `Area` per band (`areaPath(upper, { baseline: lower })`), slot `seriesSlot(index)`
     unless the band names slot, tone or colour, with `data-series` set to the key.
2. Implement and export.

## Phase 2: surfaces

Files: new `src/svg/surface.tsx`; `src/svg/line-chart.tsx` (`surface` prop), `styles.css`, `src/index.ts`.

- `ChartSurfaceName = "page" | "dark" | "paper"`, `CHART_SURFACES`, `getChartSurfaceAttributes(surface)` →
  `{ className, "data-theme"? }`, `ChartSurface` wrapper (`as`: `div` | `section` | `span`, `className`, children).
- `LineChart surface` puts the attributes on its `figure`; without it the markup is unchanged.
- Tests: markup per surface; ui's compiled scheme rule (`buildThemeCss(DEFAULT_THEME)`) matches `[data-theme="dark"]`
  on a non-root element, asserted on the generated selector.

## Phase 3: EventAxis

Files: new `src/cursor/cursor-keys.ts` (shared `getNextIndex`), `src/cursor/event-axis.tsx`, `src/svg/event-layout.ts`
(server-safe `layoutEventAxis`); `chart-cursor.tsx` imports the shared keys; `messages/{en,pl}.ts` gain
`eventAxis.label`; `styles.css`; `tests/architecture.test.ts` `LOCAL_PROPERTIES` gains the event axis' lane property.

- `EventAxisItem` is a union: `{ kind: "span", startPercent, endPercent }` | `{ kind: "milestone", xPercent }`, both
  with `key`, `label`, `detail?`, `slot?`, `tone?`, `color?`.
- `layoutEventAxis(items)` sorts by start, packs spans into the fewest lanes (greedy, a span starting where another
  ends shares its lane), puts milestones on a row of their own above, and returns the order keyboard steps follow.
- `EventAxis` (`"use client"`): `role="group"`, `tabIndex=0`, aria label from messages; arrows, Home, End and Escape
  as in the cursor; pointer enter or down on an item activates it, leaving the axis or blur clears; the active item
  gets `sft-chart-event-active`; the readout is the cursor's polite live region (label, then detail), or
  `renderReadout(item, index)`; `onActiveChange(index | null)`.
- Tests (happy-dom): lanes, keyboard order and readout, pointer, Escape, Polish label, `renderReadout`.

## Phase 4: docs

`foundation/charts/README.md` (Step series, Distinct colours, Surfaces, Event axis, Stacked areas), `CHANGELOG.md`
`## Unreleased`, package `description`.

## Progress

- [x] Phase 1: data helpers and stacked areas (`674844f`; the new test file failed on master, 14 tests green after)
- [x] Phase 2: surfaces (`359a823`)
- [x] Phase 3: EventAxis (`0e351f2`; tests in `tests/event-axis.test.tsx`, which needs `happy-dom`)
- [x] Phase 4: docs (this commit)

Gates on the branch: `npm run typecheck`, `npm run lint`, `npm run build` green; the charts package's 229 tests pass,
the full `npm test` runs in pre-push.

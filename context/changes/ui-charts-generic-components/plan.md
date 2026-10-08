# Plan: ui-charts-generic-components

Input: change.md (research and framing skipped, reasons there). Complexity: medium (two packages, five pieces, two
phases).

## Goal

`@softure-ai/ui` exports `Tabs`, `TabPanels`, `CollapsibleSection` and `SegmentedNav`; `@softure-ai/charts` exports
`smoothLinePath` and `areaPath`, and `SeriesLine` takes `curve`. Tests, READMEs, CHANGELOGs, ui 0.1.13 and
charts 0.1.5.

**Out of scope:** the adopting app's switch to these pieces; a filled `SeriesArea` component (no fill tokens yet; an
app draws the `areaPath` in its own `<path>`).

## Findings (the reading behind the plan)

- `ui/segment-classes.ts`: `SEGMENTED_GROUP_CLASS`, `SEGMENT_ACTIVE_CLASS`, `SEGMENT_IDLE_CLASS` are server-safe and
  already meant for "the links of a view picker".
- `ui/button.tsx`: `LinkComponentType` / `LinkComponentProps` inject a framework link; `ButtonLink` renders `<a>`
  without one. The same injection serves link segments.
- `ui/card-disclosure.tsx`: the arrow SVG (rotated 90° when open), `aria-expanded`, content kept mounted with
  `hidden`. A section reuses the arrow and the mounting rule.
- `ui/class-names.ts`: `createSlotClassGetter` with `classNames` / `unstyled` is the slot convention every component
  follows.
- `tests/architecture.test.ts` (ui) forbids inline copy and raw colours in `src/ui`: labels come through props.
- `charts/svg/geometry.ts`: `PlotPoint`, `linePath` (two-decimal rounding), `PLOT_HEIGHT` as the bottom of the plot.
- The adopting app's curve is Fritsch–Carlson monotone cubic: secant per segment, tangent zero at a local extremum,
  scaled down where α² + β² > 9; a vertical step (dx = 0) has secant 0. Its tests assert the curve passes through
  every point and the control points stay within each segment's y-range.

## Key decisions

- **D1 `Tabs`** (client): `items` (`id`, `label`, `content`, optional `isAlwaysMounted`), controlled (`value` +
  `onChange`) or uncontrolled (`defaultValue`, first item by default), `label` names the tablist, `activation`
  `automatic` (default: arrows select) or `manual` (arrows move focus, Enter/Space select). Roving `tabIndex`,
  ArrowLeft/ArrowRight wrap, Home/End. Tabs and panels linked by `aria-controls` / `aria-labelledby` from `useId`.
  Only the active panel renders; `isAlwaysMounted` keeps one mounted and `hidden` so a draft in it survives.
  Look: the segmented classes. Slots `root`, `list`, `tab`, `panel`.
- **D2 `TabPanels`** (server-safe): `active` + `panels` (`id`, `content`, `isAlwaysMounted`, `className`), for a tab
  bar made of links elsewhere (the active tab comes from the route). Same mounting rule as D1, `data-tab-panel`
  hook, no `role="tabpanel"` (no `role="tab"` points at it).
- **D3 `CollapsibleSection`** (client): `title`, `subtitle`, `defaultOpen`, optional `headingLevel` (2–6, wraps the
  toggle in a heading), `children`. The whole bar is the toggle button (`aria-expanded`, `aria-controls`), content
  stays mounted with `hidden`. The arrow moves into a shared `disclosure-arrow.tsx` used by `CardDisclosure` too,
  with byte-identical markup. Slots `root`, `heading`, `toggle`, `arrow`, `title`, `subtitle`, `content`.
- **D4 `SegmentedNav`** (server-safe): `items` (`id`, `href`, `label`), `current`, `label` (the `<nav>` name),
  optional `LinkComponent`, `ariaCurrent` (`page` by default). Links carry the segment classes; the current one
  `aria-current`. Slots `root`, `link`.
- **D5 charts paths:** `smoothLinePath(points)` (monotone cubic, `M` + one `C` per segment, ends exactly on the
  points, same rounding as `linePath`); `areaPath(points, { baseline, curve })` where `baseline` is a y (default
  `PLOT_HEIGHT`) or a lower edge of points, closed with `Z`. With a lower edge the outline runs back along it
  (reversed, same curve), so a stacked band is `areaPath(upper, { baseline: lower })`.
- **D6** `SeriesLine` takes `curve: "linear" | "smooth"` (default `linear`, markup unchanged).

## Phase 1: ui components (TDD)

- Tests (`tests/adoption-gaps-252.test.tsx`): tabs roles and links, roving tabIndex, arrows/Home/End selection with
  wrap, manual activation, controlled `onChange`, inactive panels unmounted and `isAlwaysMounted` hidden with state
  kept; `TabPanels` markup; section toggles `aria-expanded` and `hidden`, keeps typed input, heading level, slots;
  `SegmentedNav` `aria-current` only on the current link, classes, `LinkComponent`; `CardDisclosure` arrow markup
  unchanged.
- Code: `ui/tabs.tsx`, `ui/tab-panels.tsx`, `ui/collapsible-section.tsx`, `ui/disclosure-arrow.tsx`,
  `ui/segmented-nav.tsx`, `ui/card-disclosure.tsx`, `ui/index.ts`; README, CHANGELOG, `package.json` 0.1.13.

Done when: the new tests were seen red, then green; gates green.

## Phase 2: charts paths (TDD)

- Tests (`tests/paths.test.ts`): smooth path through every point, control points inside each segment's y-range,
  straight segments for collinear points, vertical step, 0/1/2 points; area to a number baseline, to the default,
  to a lower edge (reversed), smooth area; `SeriesLine` `curve`.
- Code: `svg/geometry.ts`, `svg/lines.tsx`, `index.ts`; README, CHANGELOG, `package.json` 0.1.5, lockfile.

Done when: the new tests were seen red, then green; gates green (typecheck, lint, test, build).

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: ui components

#### Automated
- [ ] 1.1 ui tests seen red, then green
- [ ] 1.2 README, CHANGELOG and version 0.1.13

### Phase 2: charts paths

#### Automated
- [ ] 2.1 charts tests seen red, then green
- [ ] 2.2 README, CHANGELOG and version 0.1.5
- [ ] 2.3 Gates green (typecheck, lint, test, build)

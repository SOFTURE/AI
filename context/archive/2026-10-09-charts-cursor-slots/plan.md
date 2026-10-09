# Plan: charts-cursor-slots

Input: change.md (research and framing skipped, reasons under Notes). Complexity: small (one phase, one component).

## Goal

`ChartCursor` carries an app's own readout and plot: `renderReadout`, `onActiveChange`, `frame={false}`,
`readoutClassName`, and `CursorValue.tone` / `className` next to an optional `slot`.

**Out of scope:** a controlled `activeIndex`, changes to `LineChart` (it keeps the default readout), new tokens.

## Findings (the reading behind the plan)

- `src/cursor/chart-cursor.tsx`: state `activeIndex` set from `pickAt` (pointer), `handleKeyDown`, blur and pointer
  leave; children and `.sft-chart-cursor-layer` sit in `.sft-chart-frame`; the readout is a `role="status"` div with
  the heading and one swatch, label and value per `CursorValue`.
- `styles.css`: `.sft-chart-frame` is a two-column grid; `.sft-chart-frame > .sft-chart-cursor-layer` goes to column 2,
  row 1. `.sft-chart-cursor` is `position: relative`. Dots and swatches read `--sft-chart-series`; tones set
  `--sft-chart-tone` through `.sft-chart-tone-<tone>` (`toneClass`).
- `tests/architecture.test.ts` refuses raw colours and unknown `--sft-*` properties in the components and styles.
- `src/svg/line-chart.tsx` builds `CursorPoint`s with a `slot` for every value, so an optional `slot` changes nothing
  there.

## Key decisions

- **D1 readout.** `renderReadout?: (point, index) => ReactNode`; when set and a stop is active its result is the live
  region's only content; otherwise the default heading and values.
- **D2 active stop.** All changes go through one `changeActive(next)`: it returns when `next` equals the current index,
  else sets the state and calls `onActiveChange?.(next)`. A pointer moving within one stop calls nothing.
- **D3 frame.** `frame?: boolean`, default `true` (the grid, unchanged). With `false` the wrapper is
  `.sft-chart-cursor-box` (`position: relative`) and its layer is absolute with `inset: 0`, so the layer is the app's
  plot box and `pickAt` measures it.
- **D4 colours.** `slot?: number`, `tone?: ChartTone`, `className?: string` on `CursorValue`. Colour class: a slot wins
  (as on lines), else the tone class plus `.sft-chart-fill-tone`, which sets `--sft-chart-series: var(--sft-chart-tone)`
  so dot and swatch keep reading one property; `className` is appended to the dot and the readout swatch.
- **D5 placement.** `readoutClassName?: string` appended to the readout's class.

## Phase 1: the options (TDD)

**Discipline:** TDD. **Files:** `src/cursor/chart-cursor.tsx`, `styles.css`, `tests/cursor.test.tsx`, `README.md`,
`CHANGELOG.md`, `package.json`, root `package-lock.json`.

- Tests: `renderReadout` content in the status region with point and index; `onActiveChange` sequence over keys,
  repeated pointer moves on one stop, Escape; `frame={false}` renders no `.sft-chart-frame`, one box holding children
  and the layer, guide and dot at the stop's percentages, the pointer measured on that box; tone and className on dot
  and swatch, slot winning over tone; `readoutClassName` on the status element; default markup unchanged (no
  `sft-chart-fill-tone`, frame present).

Done when: the new tests were seen red, then green; gates green (typecheck, lint, test, build).

## Risks and rollback

- An app CSS that targeted `.sft-chart-frame > .sft-chart-cursor-layer` still matches with the default `frame`.
- Rollback: revert the commit; no data, no migration.

## Progress

- [x] Phase 1: the options (TDD)

# Research: charts-event-rail

Input: change.md, issue #508. Depth: quick (one component and its layout, prior change #409 archived).
Snapshot: f854efc on claude/project-thread-1uc21g, 2026-10-15 09:15 Europe/Warsaw.

## Summary

`EventAxis` (0.1.9, #409) is a client component over a server-safe layout, `layoutEventAxis`, that puts milestones on
row 0 and packs spans into lanes below. Each item is one absolutely positioned `span` in an `aria-hidden` track; the
colour of an item is one class (`seriesColourClass({ slot, tone })`) plus an inline `--sft-chart-series`
(`seriesColourStyle(color)`). Keyboard stepping comes from the shared `getNextIndex`, the readout is a polite live
region with `renderReadout(item, index)`. A rail needs a second layout (milestones sorted by x, one segment from each
milestone to the next) and a second track markup; the group, keys, pointer handling and readout can be reused as they
are. Because a segment is its own element, its colour can come from separate fields without touching the dot's.

## Current state

- `foundation/charts/src/svg/event-layout.ts:57` `layoutEventAxis(items)`: entries sorted by start, end, input order;
  milestones lane 0, spans first-fit into lanes; positions clamped to 0–100.
- `foundation/charts/src/cursor/event-axis.tsx:33` `EventAxis`: state `activeStep` (index into `entries`), keys via
  `getNextIndex` (`src/cursor/cursor-keys.ts`), pointer enter/down activate, leave/blur clear, `onActiveChange` reports
  the input index.
- `foundation/charts/styles.css:677-761`: rows of `--sft-chart-event-lane-height` (`--sft-space-6`); a milestone is a
  ringed dot centred by `translateX(-50%)`, active scaled 1.25.
- `foundation/charts/src/svg/class-names.ts:51-60` `seriesColourClass`, `seriesColourStyle`.
- `foundation/charts/tests/architecture.test.ts:13` `LOCAL_PROPERTIES`: every local custom property is listed.
- `foundation/charts/tests/event-axis.test.tsx`: oracles for the lanes layout and markup; must stay unchanged.

## Affected surface

- `src/svg/event-layout.ts` (milestone fields, `layoutEventRail`), `src/cursor/event-axis.tsx` (`layout`,
  `minLabelWidth`, rail markup), `src/index.ts` (exports), `styles.css` (rail rules), `tests/architecture.test.ts`
  (new local properties), a new test file, README, CHANGELOG.

## Options

- **A. `layout="rail"` on `EventAxis`.** Reuses the group, keys, pointer and readout unchanged; props become a union
  so a rail takes milestones only. Matches the issue's first wording.
- **B. A separate `EventRail`.** Duplicates the interaction code or forces extracting a hook; a second component to
  document for one visual variant.

Recommendation: A.

## Risks

- A segment label in a narrow segment: the issue asks for hiding below `minLabelWidth`; text that still overflows is
  clipped with an ellipsis like a span label.
- Milestones at the same x make a zero-width segment: it has no width to draw and no label.

## Decisions (auto)

- Option A, `layout="rail"` on `EventAxis` (above).

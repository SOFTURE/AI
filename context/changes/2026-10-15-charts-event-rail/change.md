---
change_id: charts-event-rail
title: "charts: EventAxis rail layout, milestones on one line with segment tones apart from their dots (issue #508)"
status: planned
roadmap_item: null
issue: 508
branch: claude/project-thread-1uc21g
created: 2026-10-15
updated: 2026-10-15
---

## Intent

An adopting app draws a plan as one horizontal rail with `EventAxis`: milestones are dots on one line, each segment
between two consecutive milestones is coloured (in a colour of its own, not the dot's) and labelled with a short text
such as a duration, the segment label hides when the segment is too narrow, a tick label (the year) sits under each
dot, and the readout under the rail is the existing one (`renderReadout`). Keyboard and pointer behaviour stay those of
`EventAxis`.

Without `layout="rail"` the axis renders the markup of 0.2.0. A reviewer checks
`foundation/charts/tests/event-axis-rail.test.tsx`, `styles.css`, the README and the CHANGELOG `Unreleased` section.

## Context

Issue [#508](https://github.com/SOFTURE/AI/issues/508) (`pkg: charts`), a follow-up to the event axis of #409
(`context/archive/2026-10-12-charts-adoption-gaps-409/`):

> 1. A rail layout. `layout: "rail"` (or a separate `EventRail`): milestones on one line, the segments between
>    consecutive milestones drawn as the rail itself (no lanes).
> 2. `railTone` per milestone. The segment leading to a milestone can take a tone other than the milestone's own dot.
> 3. Segment label. A short text on the segment, hidden when the segment is too narrow (a `minLabelWidth` in axis
>    units).
> 4. A tick label under each dot (the year), and the readout content via the existing `renderReadout`.

## Constraints

- Only `foundation/charts` and this folder.
- Backwards compatible: every new prop optional, default markup unchanged (the #409 tests stay as they are).
- Colours and sizes stay tokens (`tests/architecture.test.ts`); new custom properties are local, with fallbacks.
- No version bump: the CHANGELOG gets an `Unreleased` section; the coordinator releases the batch.
- English only.

## Notes

- Placement: unlinked (`roadmap_item: null`, `issue: 508`); one GitHub issue is one change.
- Framing: skipped; the issue states the gaps and the expected outcome.

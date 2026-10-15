# Plan: charts-event-rail

Input: change.md, research.md. Complexity: small (one package, two phases).

## Goal

`EventAxis` gains `layout="rail"`: milestones on one line, a coloured and labelled segment from each milestone to the
next whose colour is set apart from the dot, a tick label under each dot, the existing keyboard, pointer and readout.
Default markup stays that of 0.2.0.

**Out of scope:** spans on a rail, a neutral track before the first or after the last milestone, new design tokens, a
version bump.

## Key decisions

- **D1 API.** `EventAxisProps` becomes a union on `layout`: `{ layout?: "lanes"; items: EventAxisItem[] }` or
  `{ layout: "rail"; items: EventAxisMilestone[]; minLabelWidth?: number }`. Shared props (title, className,
  renderReadout, onActiveChange, readoutClassName, copy) stay on both. `renderReadout` still takes an `EventAxisItem`.
- **D2 Milestone fields.** `EventAxisMilestone` gains, all optional and read only by the rail: `tick` (text under the
  dot), `segmentLabel` (text on the segment leading to it), and `railSlot`, `railTone`, `railColor` (the segment's
  colour, same precedence as `slot`/`tone`/`color`: colour over slot over tone). Without any rail colour the segment
  takes the milestone's own colour.
- **D3 Layout.** `layoutEventRail(milestones, { minLabelWidth = 0 })`, server-safe, returns
  `{ entries: EventRailEntry[] }` sorted by x then input order, each `{ item, index, xPercent, segment }`. `segment` is
  `{ startPercent, endPercent, isLabelShown }` from the previous milestone's x to this one's, `null` for the first
  milestone and for a zero-width segment. `isLabelShown`: a `segmentLabel` exists and the width (axis percent) is at
  least `minLabelWidth`.
- **D4 Markup.** The track gets `sft-chart-event-rail`; per entry, segments first (`span.sft-chart-event-segment` with
  the rail colour class and inline colour, `left`/`width`, `data-key="<key>"` of its milestone plus
  `data-part="segment"`, the label as `span.sft-chart-event-label` when shown), then dots (the existing milestone
  markup, without the lane property), then ticks (`span.sft-chart-event-tick`, `left`). The root gets
  `sft-chart-event-axis-rail`.
- **D5 Pointer.** A segment activates the milestone it leads to (a bigger target than the dot, and the segment belongs
  to that milestone); the active milestone's segment gets `sft-chart-event-active` too.
- **D6 CSS.** The rail track is three rows of `--sft-chart-event-lane-height`: segment label, rail, tick. The rail line
  is `--sft-chart-event-rail-width` thick (default `var(--sft-space-1)`), in the segment's `--sft-chart-series`; dots
  are centred on it. Ticks are muted, centred under their dot.

## Phase 1: rail layout and markup (TDD)

**Files:** `src/svg/event-layout.ts`, `src/cursor/event-axis.tsx`, `src/index.ts`, `styles.css`,
`tests/architecture.test.ts` (`LOCAL_PROPERTIES`), `tests/event-axis-rail.test.tsx`. Tests first: layout order, segments
and their `null` cases, `minLabelWidth`, clamping; markup of segments (rail colour apart from the dot, fallback to the
dot's), dots and ticks; keys, segment pointer and `renderReadout`; the #409 file unchanged.

## Phase 2: docs

**Files:** `README.md` (Event axis section), `CHANGELOG.md` (`## Unreleased`).

Done when: the new tests were seen red, then green; the #409 tests unchanged and green; gates green (typecheck, lint,
test, build).

## Risks and rollback

- Default markup unchanged is pinned by `tests/event-axis.test.tsx`.
- Rollback: revert the commits; no data, no migration.

## Progress

- [ ] Phase 1: rail layout and markup (TDD)
- [ ] Phase 2: docs

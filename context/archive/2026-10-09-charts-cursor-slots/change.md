---
change_id: charts-cursor-slots
title: "charts: ChartCursor takes an app's own readout, reports the active stop, works without the frame grid and colours dots by tone or class (issue #301)"
status: archived
roadmap_item: null
issue: 301
branch: claude/project-thread-a10o3x
created: 2026-10-09
updated: 2026-10-09
archived_at: 2026-10-09
---

## Intent

An adopting app replaces its hand-rolled chart cursor with `ChartCursor` and keeps its own readout panel, its own
single-`<svg>` plot and its own dot colours. `ChartCursor` gains `renderReadout`, `onActiveChange`, `frame`,
`readoutClassName`, and `CursorValue` gains `tone` and `className` (with `slot` optional). Without the new options the
markup is unchanged.

A reviewer checks the new cases in `foundation/charts/tests/cursor.test.tsx`, the cursor rules in
`foundation/charts/styles.css`, the README's cursor section and the CHANGELOG entry `0.1.6`.

## Context

Issue [#301](https://github.com/SOFTURE/AI/issues/301): the readout is fixed (heading and label/value pairs), the
active stop is private state, children always go into the `.sft-chart-frame` grid (an app with one `<svg>` gets its
plot in column 1 and the cursor layer in column 2), a dot's colour is a series slot only, and the readout always sits
under the plot.

## Constraints

- Only `foundation/charts` (cursor, styles.css, tests, README, CHANGELOG, package version) and this folder.
- Backwards compatible: every new prop is optional; `slot` turning optional widens the type only.
- The live region (`role="status"`, `aria-live="polite"`) stays the package's, whatever renders inside it.
- Colours stay tokens (the architecture test): a tone reads `--sft-chart-tone`, an app colour comes in `className`.
- Other threads change `@softure-ai/ui` and `agent-ready` in parallel; no shared files.
- English only.

## Notes

- Research: skipped as a separate artefact; the issue names the props and the one component, and `plan.md`
  § Findings holds the reading.
- Framing: skipped; the issue states the gaps and a backwards compatible proposal.
- Placement: unlinked (`roadmap_item: null`, `issue: 301`), per the project rule that each GitHub issue is one change.
- Archived 2026-10-09: charts 0.1.6 with the five options; tests, README and CHANGELOG updated.

## Decisions (auto)

- `onActiveChange` only, no controlled `activeIndex`: the issue offers either; the callback covers the app's readout
  and placement and keeps one source of truth.
- `readoutClassName` is a string: an app that floats the readout already holds the index from `onActiveChange`.
- A version bump to 0.1.6 rides this change; the release goes out with the coordinator's next wave.

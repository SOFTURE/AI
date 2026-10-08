---
change_id: ui-charts-generic-components
title: "ui + charts: tabs, collapsible section, link segmented nav, smooth line and area paths (issue #252)"
status: archived
roadmap_item: null
issue: 252
branch: claude/project-thread-nuoxi2
created: 2026-10-08
updated: 2026-10-08
archived_at: 2026-10-08
---

## Intent

Ship the generic pieces an adopting app still keeps because `@softure-ai/ui` 0.1.12 and `@softure-ai/charts` 0.1.4
have no counterpart ([#252](https://github.com/SOFTURE/AI/issues/252)), so the app can delete its copies:

- **ui:** tabs (a `role="tablist"` with roving focus and its panels, plus server-safe panels for a tab bar made of
  links elsewhere), a collapsible section (the `CardDisclosure` gesture for any section, not only a card), and a
  segmented navigation made of links (`aria-current`, works without JavaScript) with the `SegmentedControl` look.
- **charts:** a smooth line path (monotone cubic, through every point, no overshoot) and an area path (a line closed
  to a baseline or to a lower edge, which is what stacked areas need).

A reviewer checks the new tests in `foundation/ui/tests/` and `foundation/charts/tests/`, the READMEs, the
CHANGELOGs and the version bumps (ui 0.1.13, charts 0.1.5).

## Context

- `SegmentedControl` is a radio group; `segment-classes.ts` already exports the segmented look as plain classes "for
  the links of a view picker", but no component renders them as links.
- `CardDisclosure` toggles a card's content under its header; its arrow and the `hidden` (not unmounted) content are
  the behaviour a collapsible section needs too.
- `charts` has `linePath` (a polyline over `PlotPoint`s) and `SeriesLine`; there is no curve and no area.
- No roadmap: issues are the tracker (project rule 2026-10-07). No other open issue touches ui or charts, so this
  thread releases both after the merge.

## Constraints

- English-only code, comments and commits; neutral wording on GitHub and in the repo.
- Backward compatible: new exports only; `SeriesLine` gains an optional `curve` whose default keeps today's markup.
- ui stays framework-free: links come through the existing `LinkComponent` injection.
- No inline copy and no raw colours in `src/ui` (architecture test); the new components take every visible text
  through props.

## Process notes

- Research: skipped as a separate artefact. The issue names the source components and the package files they map
  onto; the reading fits in `plan.md` § Findings.
- Framing: skipped. Each item is a concrete missing primitive with an existing in-package precedent
  (`CardDisclosure`, segment classes, `linePath`); there is no competing explanation of the problem to weigh.

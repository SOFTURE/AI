---
change_id: theme-notion-fold-row-action-column
title: "theme-notion: FoldRow's action column spans the whole bar and takes a status (issue #1471)"
status: archived
roadmap_item: null
issue: 1471
branch: claude/project-thread-c40axi
created: 2026-11-25
updated: 2026-11-25
archived_at: 2026-11-25
---

## Intent
A `FoldRow` with `actions` reads as one box: the actions column is as high as the summary however many lines the
summary wraps to, lit together with it on hover and when open, and it can carry a status above the actions. An
adopting app drops its local wrapper around `FoldRow`. Issue #1471 (`enhancement`, `pkg: theme-notion`, `adoption`).

## Context
With `actions`, `FoldRow` draws `fold-row-actions` beside the `<details>` (a control inside the `<summary>` would fold
the row), only `min-h-row-height`/`min-h-touch-target` high and centred on the first line. On a summary that wraps to
several lines, the strip's background ends under the control while the summary's continues: two boxes. There is no
place for a status above the action. Related, closed: #1463 (one 8 px inset, PR #1467, not released yet).

## Scope
- The actions column spans the summary's full height and shares its hover and open background.
- An optional `status` slot, drawn above the actions in that column.
- On a phone (below `md`) the column wraps under the summary, and its controls are at least 44 px.
- Tests (a three-line summary, a status and one action, measured in Chromium), a gallery case, the parity fixture,
  the visual baselines, README, CHANGELOG `Unreleased` (no version bump: releases are batched).
- Out of scope: the adopting app; the row without `actions` and `status` stays as it is.

## Decisions (auto)
- Recorded in `plan.md`.

## Notes
- frame skipped: a reported gap with one proposed shape and acceptance criteria in the issue.

## Done
`FoldRow`'s right column (`actions`, and the new `status` above them) spans the summary's full height and lights with
it as one box, open or hovered; below `md` it falls under the summary with 44 px actions. With a column the row is a
grid and the opened content sits under the whole bar. Tests (red first), a Chromium measurement, the `FoldRow[actions]`
gallery case, parity fixture, four gallery baselines, README and CHANGELOG `Unreleased`; ships in the next
theme-notion release. An adopting app drops its local wrapper around `FoldRow`.

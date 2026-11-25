---
change_id: theme-notion-fold-row-inset
title: "theme-notion: FoldRow's bar and opened content share one inset (issue #1463)"
status: open
roadmap_item: null
issue: 1463
branch: claude/project-thread-ld8oym
created: 2026-11-25
updated: 2026-11-25
---

## Intent
An opened `FoldRow` lines its details up with its bar: the chevron and the details table start at the same x, so an
app no longer overrides the insets on every row. Issue #1463 (`pkg: theme-notion`).

## Context
`FoldRow`'s summary is padded `px-1` (4 px), the opened content `p-3` (12 px), so the table sits 8 px further in than
the chevron above it; an app's link rows next to it use `px-2`. An adopting app sets
`[&_[data-slot=fold-row-summary]]:px-2 [&_[data-slot=fold-row-content]]:px-2` on each row as a workaround.
Related, closed: #832 (equal padding on all four sides, `isInset` keeps the indented look).

## Scope
- One horizontal inset, `px-2` (8 px), for the summary, the default content (`px-2 py-3`) and the actions' right edge.
- The `isInset` content follows the new inset: `pr-2`, and `pl-8` so it starts under the title (8 + 16 chevron + 8 gap).
- Tests, parity fixture, visual baselines, README, CHANGELOG `Unreleased` (no version bump: releases are batched).
- Out of scope: the adopting app (the CHANGELOG says which override it can drop).

## Decisions (auto)
- `px-2` on both, as the issue proposes: it matches the app's link rows and Notion's list rows.
- Vertical padding of the default content stays 12 px (`py-3`), as the issue proposes.
- The actions' right padding moves from `pr-1` to `pr-2`, so the bar keeps the same inset on both ends.
- `isInset` moves from `pl-6 pr-1` to `pl-8 pr-2`: its documented purpose is "under the title", and the title now
  starts at 32 px.
- Patch-level change, recorded under `Unreleased`; the coordinator cuts the release.

## Notes
- research skipped: the cause (two padding classes in one file) and the fix are named in the issue; the component's
  tests and fixture are the only consumers in the repository.
- frame skipped: a reported, reproduced visual gap with one proposed shape.

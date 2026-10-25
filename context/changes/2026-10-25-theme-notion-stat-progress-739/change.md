---
change_id: theme-notion-stat-progress-739
title: "theme-notion: progress bar in StatCard (issue #739)"
status: in_progress
roadmap_item: null
issue: 739
branch: claude/project-thread-h4usah
created: 2026-10-25
updated: 2026-10-25
---

## Intent

Close [issue #739](https://github.com/SOFTURE/AI/issues/739): a `StatCard` takes an optional `progress` (0–100) and
draws a bar under its figure, so an adopting app keeps `StatCards` for budget-style figures instead of rebuilding the
card around `Progress`.

## Context

- Labels: `enhancement`, `pkg: theme-notion`. Follows `StatCards` (#722).

## Constraints

- No markup change for a card without `progress`.
- Bar drawn with the package's `Progress` (6 px); indicator in `TONE_FILL[tone]` when a tone is set, primary otherwise;
  value clamped to 0–100; accessible name `progressLabel ?? label`.
- English only, no version bump (the coordinator releases in a batch).

## Notes

- Framing: skipped. The issue names the outcome, the API and the acceptance tests.

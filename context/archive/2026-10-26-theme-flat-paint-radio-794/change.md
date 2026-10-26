---
change_id: theme-flat-paint-radio-794
title: "theme-flat-paint: look maps for radio choices, choice row and choice card (issue #794)"
status: archived
roadmap_item: null
issue: 794
branch: claude/project-thread-kisvhq
created: 2026-10-26
updated: 2026-10-26
archived_at: 2026-10-26
---

## Intent

Close [issue #794](https://github.com/SOFTURE/AI/issues/794): an adopting app stops hand-writing two radio looks
that disagree on the checked state. The theme exports `RADIO_LOOK` (the 20 px control with one checked drawing: a
lime disc with a black check, as the checkbox and the switch knob), `CHOICE_ROW_LOOK` (a list row with the 3 px lime
bar) and `CHOICE_CARD_LOOK` (a bordered tile), with tests against the theme's tokens.

## Context

- Labels: enhancement, theme-flat-paint. Found while adopting the theme in an adopting app.
- ui has no radio group component yet; the maps describe the markup the app writes (a `label` wrapping a native
  radio), so a later `RadioGroupField` in ui can take them as slots.

## Constraints

- No version bump: the coordinator releases. CHANGELOG under `Unreleased`.
- Other changes run in this package at the same time (#779, #781, #782, #784, #795): the new maps live in a file of
  their own (`src/look/choice.ts`) to keep merges small; fresh master is merged in before the merge.

## Notes

- Framing: skipped. The issue names the outcome and the exact classes.

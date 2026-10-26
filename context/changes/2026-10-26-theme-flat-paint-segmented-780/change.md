---
change_id: theme-flat-paint-segmented-780
title: "theme-flat-paint: slot maps for ui's SegmentedControl and ThemeSwitch (issue #780)"
status: in_progress
roadmap_item: null
issue: 780
branch: claude/project-thread-xxkzrz
created: 2026-10-26
updated: 2026-10-26
---

## Intent

Close [issue #780](https://github.com/SOFTURE/AI/issues/780): an adopting app stops writing the same slot map twice
for ui's `SegmentedControl` and `ThemeSwitch`. The theme exports `SEGMENT_ACTIVE_WHEN_CHECKED_LOOK` (the active
segment as `has-checked:` variants) and two ready slot maps, `SEGMENTED_CONTROL_LOOK` and `THEME_SWITCH_LOOK`, used
with `unstyled`, so the active segment is never lime.

## Context

- Labels: enhancement, theme-flat-paint. Found while adopting the theme 0.1.0 in an adopting app.
- ui renders each option as a `label` wrapping a native radio; the checked option is `:has(:checked)`.

## Constraints

- No version bump: the coordinator releases. CHANGELOG under `Unreleased`.
- The theme keeps no runtime dependency on ui: slot types are declared locally (as `CheckboxSlot`) and pinned to
  ui's by a type test.

## Notes

- Framing: skipped. The issue names the outcome and the exact classes.

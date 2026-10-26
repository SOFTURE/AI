---
change_id: theme-flat-paint-segmented-780
status: archived
---

# Plan: SegmentedControl and ThemeSwitch slot maps (issue #780)

Input: change.md, research.md. Complexity: small (one look file, tests, docs).

## Phase 1: look maps

Files: `themes/theme-flat-paint/src/look/controls.ts`, `src/index.ts`, `tests/*`, `README.md`, `CHANGELOG.md`.

1. `SEGMENT_ACTIVE_WHEN_CHECKED_LOOK`: `SEGMENT_ACTIVE_LOOK`'s state classes as `has-checked:` variants.
2. `SegmentedControlSlot`, `ThemeSwitchSlot` types; `SEGMENTED_CONTROL_LOOK` (root reset, legend `sr-only`, options
   = group, option = idle + checked + focus outline, input `sr-only`, label empty) and `THEME_SWITCH_LOOK` (the
   same map).
3. Tests: exact values of the new exports; slot types equal ui's (`expectTypeOf`); compiled CSS has
   `has-checked:bg-surface` and the focus outline; rendering ui's `SegmentedControl` with the map puts no lime class
   on the checked option.
4. Barrel, README table, CHANGELOG `Unreleased`.

## Decisions (auto)

- `has-focus-visible:` instead of the issue's `has-[:focus-visible]:`: same selector, the form ui uses.
- Legend `sr-only` in both maps, as in the issue; an app that wants it visible spreads the map and sets `legend`.
- `label: ""`: the option carries the weight and colour; the span needs nothing.

## Progress

- [x] Phase 1: look maps (788ebb1, tests 45/45 in the package)

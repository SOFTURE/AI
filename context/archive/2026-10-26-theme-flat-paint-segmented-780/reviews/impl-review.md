---
change_id: theme-flat-paint-segmented-780
verdict: approved
---

# Implementation review

- Plan conformance: every step of phase 1 landed; no file outside the plan was touched.
- Issue asks: `SEGMENT_ACTIVE_WHEN_CHECKED_LOOK`, `SEGMENTED_CONTROL_LOOK: Record<SegmentedControlSlot, string>`,
  `THEME_SWITCH_LOOK: Record<ThemeSwitchSlot, string>`; active = surface, `line-strong`, semibold, no colour; focus =
  2 px `accent` outline.
- Tests: exact values, slot types pinned to ui's at typecheck, compiled CSS carries `has-checked:bg-surface` and
  `has-focus-visible:outline-accent`, server render of ui's `SegmentedControl` and `ThemeSwitch` with the maps has no
  `accent-fill` and no `sft:` class.
- Gates: typecheck, ESLint on the package, language gate green; full `npm test` runs in the pre-push hook.
- Findings: none.

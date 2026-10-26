---
change_id: theme-flat-paint-look-maps-782
verdict: approved
---

# Implementation review

Reviewed commit 0bf7310 against plan.md and issue #782.

- Maps: `HINT_LOOK` (appearance object with `triggerGap: 8`), `CHECKLIST_LOOK`, `STEPPER_LOOK`, `MENU_PANEL_LOOK`,
  `COLOR_FIELD_LOOK` in `src/look/`, exported from the root with their slot types. Every delta the issue lists maps
  to a slot; per-state looks use `in-data-done:` / `in-data-[state=…]:` on the attributes ui already sets.
- Overrides checked against ui's defaults: the base marker classes (`border-line-strong`, `bg-transparent` /
  `bg-background`) also reset ui's done look, so the done variants restate border, fill and text; the panel resets
  ui's `-translate-y-1` in the `starting:` and closed states as well, so only the scale moves.
- Tests: `tests/index.test.ts` covers each map's slots; `tests/theme-css.test.ts` compiles the look folder with the
  real Tailwind CLI and finds every class of the marker, panel, preset and trigger maps as an escaped selector.
- Docs: README look-map table and a note on state variants; CHANGELOG `Unreleased` with what an app replaces.
- Not a theme-notion change, so the NOTION design system artifact needs no sync.
- Gates: typecheck, ESLint, language gate green (pre-commit); theme-flat-paint tests 45/45; theme-kit and
  theme-flat-paint build; full `npm test` runs in pre-push.

Verdict: approved, no changes.

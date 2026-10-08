---
change_id: ui-switch-hint-state-slots
title: "ui: Switch hintProps, state slots that survive unstyled, a hint slot and an inline hint layout (issue #281)"
status: archived
roadmap_item: null
issue: 281
branch: claude/project-thread-whg55t
created: 2026-10-08
updated: 2026-10-08
archived_at: 2026-10-08
---

## Intent

Let an adopting app render `Switch` of `@softure-ai/ui` with its own look, the way it already does with
`SwitchControl`, `Checkbox` and `SegmentedControl` ([#281](https://github.com/SOFTURE/AI/issues/281)):

1. `hintProps` (`HintAppearance`) on `Switch`, as on `Card` and `Field` (#218), so its "?" matches the app's other
   hints.
2. `stateOn` and `stateOff` slots for the two state lines, and `unstyled` no longer breaks them: the classes that
   pick the visible line (and the `sft:group/switch` marker they read) are behaviour and stay under `unstyled`.
3. A `hint` slot on the wrapper of the "?", and a default label row in which the "?" rides with the last word of a
   wrapping label instead of standing alone on its own line.
4. Documented ids: the description is `<id>-description`, the hint bubble `<id>-hint`.

A reviewer checks the new test file in `foundation/ui/tests/`, the README, the CHANGELOG and the version bump
(ui 0.1.14).

## Context

- `Switch` (`foundation/ui/src/ui/switch.tsx`) renders `Hint` directly with `anchorLeft` and its default look.
- The state lines carry `STATE_ON` / `STATE_OFF` only when not `unstyled`; the root's `sft:group/switch` is part of
  the frame default, so `unstyled` drops both and both lines show at once.
- `labelRow` is `flex items-baseline gap-1.5`: a wrapping label takes the full width and the "?" is pushed to the
  edge or to its own line.

No roadmap: issues are the tracker.

## Constraints

- English-only code, comments and commits; neutral wording on GitHub and in the repo.
- Backward compatible API: every new prop and slot is optional. The default label row changes its layout on purpose
  (item 3); its markup gains one wrapper `span` around the "?".
- Only `@softure-ai/ui` changes. Bumps it 0.1.13 → 0.1.14; no other open pull request touches ui.

## Process notes

- Research: skipped as a separate artefact. The issue names the one component, and the reading needed (the slot
  getter, `HintAppearance`, the `Select` behaviour-class precedent, the inline layout) fits in `plan.md` § Findings.
- Framing: skipped. The issue reports three concrete gaps with their visible effect and proposes mechanisms the
  package already uses (`hintProps`, slots); the one open choice (slots vs. behaviour kept under `unstyled`) is a
  plan decision, not a question of whether to build it.

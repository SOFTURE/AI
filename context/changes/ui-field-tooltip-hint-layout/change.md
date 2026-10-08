---
change_id: ui-field-tooltip-hint-layout
title: "ui: Field keeps the tooltip \"?\" next to the last word of a wrapping label (issue #284)"
status: plan_reviewed
roadmap_item: null
issue: 284
branch: claude/project-thread-whg55t
created: 2026-10-08
updated: 2026-10-08
---

## Intent

Give `Field` (and the form fields built on it: `TextField`, `PasswordField`, `MoneyField`, `SelectField`) the
inline label row `Switch` got in #281, so that with `hintAs="tooltip"` and a wrapping label the "?" stays next to
the label's last word instead of being pushed to the edge of the row or onto a line of its own
([#284](https://github.com/SOFTURE/AI/issues/284)). The wrapper of the "?" gets its own slot, named so it does not
collide with the existing `hint` slot (the block hint under the field).

A reviewer checks the new test file in `foundation/ui/tests/`, the README and the CHANGELOG (ui 0.1.14, the same
unreleased version as #281).

## Context

- `Field` (`foundation/ui/src/ui/field.tsx`, server-safe) renders `labelRow` as a `div` with
  `mb-1.5 flex items-baseline gap-1.5`, the `<label>`, and a `CopyHint` for a tooltip hint.
- `FieldSlot` is `root | labelRow | label | error | hint`; `hint` is the block hint under the control.
  `pickFieldSlots` in `form-fields.tsx` forwards those five slots from the input fields' `classNames`.
- #281 (archived as `context/archive/2026-10-08-ui-switch-hint-state-slots/`) measured the layout and found that a
  block row must carry the label's font metrics, or it takes a taller strut from the inherited font.

No roadmap: issues are the tracker.

## Constraints

- English-only code, comments and commits; neutral wording on GitHub and in the repo.
- Backward compatible API; the label row layout changes on purpose and its height must not change.
- Only `@softure-ai/ui` changes; ships in 0.1.14 together with #281, released once after the merge.

## Process notes

- Research: skipped. The reading is the same component family #281 read, and the mechanism and its pitfall
  (strut height) were measured there; the plan's Findings carry the Field specifics.
- Framing: skipped. A follow-up of #281 with the same visible defect and the same fix; nothing to weigh.

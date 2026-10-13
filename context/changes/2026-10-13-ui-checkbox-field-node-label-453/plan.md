---
change_id: ui-checkbox-field-node-label-453
status: open
---

# Plan: CheckboxField ReactNode label (issue #453)

Input: change.md, research.md. Complexity: small (one props type, tests, docs).

## Phase 1: widen the label (TDD)

Files: `foundation/ui/src/ui/form-fields.tsx`; new test `foundation/ui/tests/adoption-gaps-453.test.tsx`.

1. Tests first: a `statement` with a label holding a link renders the link inside the `<label for>` of the box and
   the box's accessible name is the full text ("I accept the terms"); a `setting` with a node label renders it; a
   `setting` with a node label, a tooltip hint and `switchProps.hintLabel` names the "?" with it. The type test is
   the compile itself (typecheck fails today).
2. Implement: `label: ReactNode` with a doc comment; `switchProps` picks `hintLabel` too.

## Phase 2: docs

`README.md` (the existing consent example now type-checks; mention `hintLabel` for a node label with a tooltip),
`CHANGELOG.md` `## Unreleased`.

## Progress

- [ ] Phase 1: widen the label
- [ ] Phase 2: docs

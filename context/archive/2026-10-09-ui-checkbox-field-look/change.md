---
change_id: ui-checkbox-field-look
title: "ui: CheckboxField forwards slots and hint look to its control (issue #340)"
status: archived
roadmap_item: null
issue: 340
branch: claude/project-thread-x6bb9u
created: 2026-10-09
updated: 2026-10-09
archived_at: 2026-10-09
---

## Intent

Close [issue #340](https://github.com/SOFTURE/AI/issues/340): `CheckboxField` renders a `Switch` (`setting`) or a
`Checkbox` (`statement`) but forwards only `unstyled`, `locale` and `messages`, so an app that styles its switches
through slots cannot use it and keeps its own copy of the submit replay. After the change the field takes
`switchProps` (`classNames`, `controlClassNames`, `hintProps` of `Switch`) and `checkboxProps` (`classNames` of
`Checkbox`) and passes them to the control it renders, in both modes and under `unstyled`.

A reviewer checks `foundation/ui/tests/adoption-gaps-340.test.tsx`, the README paragraph on `CheckboxField` and the
CHANGELOG entry.

## Context

Filed against ui 0.1.14 by an adopting app; 0.1.15 is on npm and still has it. Work is tracked in GitHub Issues, one
issue per change: no roadmap item. Ships as 0.1.16, shared with the other ui changes in flight.

## Constraints

- The submit replay (`getCheckedAfterSubmit`, the remount key) stays as it is; existing tests keep passing.
- Additive API only: no existing prop changes meaning.

## Notes

- Research: skipped as a separate file. The issue names the component and the props; reading `form-fields.tsx`,
  `switch.tsx`, `hint.tsx` and their tests answered every unknown (plan.md, Today).
- Framing: skipped. The gap is observed with its cause and a proposed API.

## Decisions (auto)

1. Take the issue's first proposal: `switchProps` and `checkboxProps` as `Pick`s of the control props, not a render
   prop. It keeps the control (and so the replay key and ids) owned by the field.
2. The id default stays generated (`useId`), as in every package field. The issue only asked to consider
   `field-<name>`; a name may repeat on a page and the package fields do not derive ids from names today. An app
   that relies on a selector passes `id`.

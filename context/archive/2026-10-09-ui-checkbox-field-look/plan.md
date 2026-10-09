---
change_id: ui-checkbox-field-look
status: archived
---

# Plan: CheckboxField forwards the control's look (issue #340)

Input: change.md (research and framing skipped, reasons there). Complexity: small (one phase plus docs).

## Today (master `dfaa508`)

- `foundation/ui/src/ui/form-fields.tsx`: `CheckboxField` renders `<Checkbox … unstyled>` for `statement` and
  `<Switch … unstyled locale messages>` for `setting`; no slot or hint look reaches either.
- `Switch` takes `classNames` (`SwitchSlot`), `controlClassNames` (`SwitchControlSlot`), `hintProps`
  (`HintAppearance`); `Checkbox` takes `classNames` (`CheckboxSlot`).

## Decisions

See change.md, Decisions (auto).

## Phase 1: forward the look (TDD)

Files: `foundation/ui/src/ui/form-fields.tsx`, `foundation/ui/tests/adoption-gaps-340.test.tsx`.

1. Tests first, red on master (typecheck and render): `switchProps` slots reach the `Switch` and its control under
   `unstyled`; `switchProps.hintProps` reaches the tooltip "?"; `checkboxProps.classNames` reach the `Checkbox` under
   `unstyled`; the replay still checks the box with the app's look.
2. Add `switchProps?: Pick<SwitchProps, "classNames" | "controlClassNames" | "hintProps">` and
   `checkboxProps?: Pick<CheckboxProps, "classNames">` and spread them on the control.

Done when: the new tests fail on master and pass after; `npm run typecheck`, `npm run lint`, `npm test`,
`npm run build` are green.

## Phase 2: docs and version

Files: `foundation/ui/README.md`, `foundation/ui/CHANGELOG.md` (`## 0.1.16`), version 0.1.16 in `package.json` and
`package-lock.json`.

## Progress

- [x] Phase 1: forward the look (4 new tests red on master, green after)
- [x] Phase 2: docs, version 0.1.16

Gates on the branch: `npm run typecheck`, `npm run lint`, `npm run build` green; the full `npm test` runs in pre-push.

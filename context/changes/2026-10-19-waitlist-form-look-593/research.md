---
change_id: waitlist-form-look-593
---

# Research: waitlist-form-look-593

Sources: `modules/waitlist/src/ui/waitlist-form.tsx`, `src/ui/index.ts`, `src/next/waitlist.tsx`,
`tests/waitlist-form.test.tsx`, `tests/next-join.test.tsx`, `README.md` (sections 4 and 8), `CHANGELOG.md`,
`foundation/ui/src/ui/form-fields.tsx` (`TextField`, `BaseFieldProps`), `src/ui/switch.tsx` (`Checkbox`),
`src/ui/button.tsx`, `modules/auth/src/ui/auth-forms.tsx` (#588).

- `WaitlistForm` renders `TextField` (name, type, label, autoComplete, required, defaultValue, error, locale,
  unstyled), one `Checkbox` per scope (name, label, required, defaultChecked, unstyled; keyed by id and checked state)
  and `<Button type="submit" variant="primary" fullWidth pending>`. Slots: root, form, scopes, notice, unsubscribe.
- ui `TextField` takes `id`, `placeholder`, `classNames: ClassNames<InputFieldSlot>`, `hintAs`, `hintProps`.
  `Checkbox` takes `id`, `description` (own `description` slot), `classNames: ClassNames<CheckboxSlot>` and had all
  three before ui 0.3.1, so waitlist's `^0.3.0` range stays. `Button` takes `variant`, `fullWidth`,
  `classNames.root`. `ButtonVariant`, `CheckboxSlot`, `InputFieldSlot`, `HintPlacement`, `HintAppearance` are exported.
- Auth (#588) passes `classNames={{ root: slot("submit") }}` to its button with an empty default for `submit`, and
  `{ classNames: fieldClassNames, hintAs: fieldHintAs, hintProps: fieldHintProps }` to each field.
- `Waitlist` (server) maps the config's scopes to `{ id, label, required }`, with `consentLabels` per id, and passes
  `classNames`, `unstyled`, `success`.
- Without an `id`, `TextField` and `Checkbox` generate one with `useId`, so ids change with the tree.

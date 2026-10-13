---
change_id: ui-checkbox-field-node-label-453
---

# Research: ui-checkbox-field-node-label-453

Sources: `foundation/ui/src/ui/form-fields.tsx`, `foundation/ui/src/ui/switch.tsx`, `foundation/ui/README.md`,
`foundation/ui/tests/{form-fields,adoption-gaps-340,adoption-gaps-407}.test.tsx`.

- `CheckboxFieldProps` (form-fields.tsx) declares `label: string`; it passes `label` unchanged to `Checkbox`
  (`statement`) or `Switch` (`setting`). Nothing in `CheckboxField` reads the label as text.
- `CheckboxProps.label` and `SwitchProps.label` are already `ReactNode`. Both render the label inside a
  `<label htmlFor>`, so the accessible name is the label's text content, links included.
- `Switch` derives the "?" trigger name from the label only when it is a string
  (`hintLabel ?? formatMessage(copy.hintLabel, { label: typeof label === "string" ? label : "" })`); a node label gives
  "Hint: ". `SwitchProps.hintLabel` overrides it, but `CheckboxField.switchProps` picks only `classNames`,
  `controlClassNames` and `hintProps`.
- README already documents `label={<>I accept the <Link href="/terms">terms</Link></>}` for `CheckboxField`; it does
  not type-check against 0.2.0. The change makes the docs true.

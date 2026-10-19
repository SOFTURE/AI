---
change_id: auth-consent-field-588
---

# Research: auth-consent-field-588

Sources: `modules/auth/src/ui/auth-forms.tsx`, `src/next/pages.tsx`, `src/next/actions.ts`, `src/contract.ts`,
`src/messages/en.ts`, `tests/forms.test.tsx`, `foundation/ui/src/ui/form-fields.tsx` (`CheckboxField`, `TextField`,
`PasswordField`, `BaseFieldProps`), `src/ui/switch.tsx` (`Checkbox`), `foundation/ui/CHANGELOG.md`.

- `RegisterForm` renders `<Checkbox name="consent" required error={errors.at("consent")} />`. `Checkbox` takes `id`,
  `onInvalid`, `onChange`, `classNames` (`CheckboxSlot`) and `error`; its error element is `${id}-error`.
- ui's `CheckboxField` (statement mode, `requiredMessage` since ui 0.2.0, so inside auth's `^0.3.0`) implements the
  bubble replacement: `onInvalid` → `preventDefault`, show the message, focus the box if it is the form's first invalid
  control; `onChange` to checked clears it. It takes no `error` prop: the error is `invalidMessage ?? useFieldError(name)`
  from the `ActionForm` context, and it spreads `checkboxProps` before its own `error`. The auth forms use
  `useActionState`, not `ActionForm`, so a server `consent` error cannot reach `CheckboxField` today.
- `useErrors` gives a field error to `at(field)` and `form` only when `state.field` is undefined. The register action
  maps `auth.consent_required` to field `consent` (`actions.ts`), so with the box not rendered the message is lost.
- `TextField` / `PasswordField` take `classNames?: ClassNames<InputFieldSlot>` and `hintProps?: HintAppearance`, both
  exported from `@softure-ai/ui`. The five forms pass neither.
- `messages.errors.auth.consent_required` exists ("You need to accept the terms to create an account.").
- Tests render forms with happy-dom and `@testing-library/react`; `fireEvent.submit` does not run constraint
  validation, so the invalid path is driven with `fireEvent.invalid` on the box (as ui's own tests do).

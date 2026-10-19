---
change_id: auth-consent-field-588
status: archived
---

# Plan: consent box and field looks in the auth forms (issue #588)

Input: change.md, research.md. Complexity: small (one file of forms, tests, docs).

## Phase 1: consent box, unrendered field errors, field looks (TDD)

Files: `modules/auth/src/ui/auth-forms.tsx`, `tests/forms.test.tsx`.

1. Tests first:
   - an unticked consent box's `invalid` event shows `errors.auth.consent_required` under the box (the event is
     cancelled), the box gets `aria-invalid`; ticking it clears the message;
   - `consentProps={{ id: "field-consent", classNames: { root: "app-consent" } }}` gives `#field-consent`, the error at
     `#field-consent-error` after a server `consent` error, and the root class;
   - with `requireConsent={false}`, a server `auth.consent_required` with `field: "consent"` shows as the form alert;
   - `fieldClassNames={{ label: "app-label" }}` and `fieldHintProps` reach every text/password field of a form
     (RegisterForm and LoginForm).
2. `ConsentCheckbox` (module-private): ui `Checkbox` plus local state for the required message, `onInvalid` and
   `onChange` as in ui's `CheckboxField`; the server error shows when no local message is set.
3. `useErrors(state, messages, rendered)`: `form` also takes the message when `state.field` is not in `rendered`.
4. `AuthFormBaseProps`: `fieldClassNames`, `fieldHintAs`, `fieldHintProps`; every field gets them (`fieldHintAs`
   added because ui applies `hintProps` only to a tooltip hint, and the auth hints are block hints by default). `RegisterFormProps`:
   `consentProps`.

## Phase 2: docs

`modules/auth/README.md` (Your own forms, Appearance), `CHANGELOG.md` `## Unreleased` with the migration for the
app's workaround (drop `requireConsent={false}` and its own box, pass `consentProps`, `fieldClassNames`).

## Progress

- [x] Phase 1: consent box, unrendered field errors, field looks (5 tests written first; 406 auth tests pass; ec11c63)
- [x] Phase 2: docs (README Your own forms and Appearance, CHANGELOG `## Unreleased` with the migration)

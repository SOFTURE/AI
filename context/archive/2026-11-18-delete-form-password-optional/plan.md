# Plan: delete-form-password-optional

One phase, test first: a form test that expects the password field not to be required next to a provider (red on the
old form), `required` on `PasswordField` with a test, the form passing `required={providers.length === 0}`.

## Progress

- [x] Phase 1: tests red, fix, tests green (ui form fields and privacy, 185 tests).

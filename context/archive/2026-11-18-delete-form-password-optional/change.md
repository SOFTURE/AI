---
change_id: delete-form-password-optional
title: The delete form lets an empty password through when a provider is offered
status: archived
created: 2026-11-18
archived: 2026-11-18
roadmap_item: null
---

## Intent

An adopting app's end-to-end test showed that an account a provider created could not send the delete form: the
password field (`PasswordField` of `@softure-ai/ui`) is always `required`, so the browser refused the empty field and
the server never got to ask for a fresh sign-in. `PasswordField` takes `required` (default `true`), and
`DeleteAccountForm` makes the password optional while it offers a provider.

## Notes

Research and frame skipped: the cause is one attribute, found from the failing test's trace.

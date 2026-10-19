---
change_id: auth-consent-field-588
title: "auth: RegisterForm's consent box with requiredMessage, id and look, and field classNames on every form (issue #588)"
status: archived
roadmap_item: null
issue: 588
branch: claude/project-thread-tnq1ni
created: 2026-10-19
updated: 2026-10-19
archived_at: 2026-10-19
---

## Intent

Close [issue #588](https://github.com/SOFTURE/AI/issues/588). An adopting app moved its auth pages to
`@softure-ai/auth/ui` and found two gaps:

1. `RegisterForm` renders the consent box with native `required` only, so an unticked box shows the browser's bubble
   instead of a localized line under the box; the app cannot give the box an `id` or its look. The app's workaround
   (`requireConsent={false}` plus its own box in `extraFields`) silently drops a server-side `consent` error.
2. The forms pass no `classNames` or `hintProps` to their ui fields, so an app cannot match its other forms' labels.

## Context

Labels: `enhancement`, `pkg: auth`, `adoption`. auth 0.2.3 is the latest on npm and on master; ui 0.3.3 (auth needs
`^0.3.0`). Releases are batched by the coordinator: no version bump here, the CHANGELOG gets `## Unreleased`.

## Acceptance

- Submitting `RegisterForm` with the consent box unticked shows `messages.errors.auth.consent_required` under the box
  (no browser bubble), and ticking the box clears it.
- `RegisterForm` takes `consentProps` (`id`, `classNames`); with `id: "field-consent"` the box is `#field-consent` and
  its error `#field-consent-error`.
- A server-side error for a field the form does not render (e.g. `consent` with `requireConsent={false}`) shows as the
  form error instead of being dropped.
- Every form takes `fieldClassNames` and `fieldHintProps` and passes them to each of its text and password fields.
- Existing calls render the same fields, names and defaults.

## Notes

- Framing: skipped. The issue states the problem, the proposal and the acceptance.

## Decisions (auto)

- The consent box stays the ui `Checkbox`, wrapped in a small auth component that adds the `requiredMessage`
  behaviour (cancel the bubble, show the message, focus the box when it is the first invalid control), instead of
  ui's `CheckboxField`: `CheckboxField` takes no explicit `error` (it reads errors from an `ActionForm` context the
  auth forms do not use), so the server's `consent` error could not reach it without a ui change and a coordinated
  ui release. Recorded as a possible ui follow-up only if a second package needs it.
- Both proposals of item 1 are taken: the box gets the message and `consentProps`, and a field error whose field is
  not rendered falls back to the form error (covers the app's own consent box and any future field).
- `fieldClassNames` is `ClassNames<InputFieldSlot>` and `fieldHintProps` is `HintAppearance`, the types ui's
  `TextField` and `PasswordField` take; they live on the shared base props, so all five forms get them. The consent
  box's look is `consentProps.classNames` (`CheckboxSlot`), because a checkbox has other slots.
- The ready pages (`createRegisterPage`, ...) are unchanged: the issue is about the forms an app mounts itself.

# Implementation review: auth-invitation-revoke-confirm

Verdict: approve. Matches the plan: Revoke stays the row form's submit button; with JavaScript its click opens
`@softure-ai/ui`'s `Modal` (width `confirmation`) titled with the email, the body states the effect, `ModalFooter`
gives Cancel, and the danger Revoke calls `requestSubmit()` with the row's Revoke button as submitter, so the server
action, redirect, pending state and row error are unchanged and the no-JavaScript post still works. Tests cover the
issue's acceptance (dialog, Cancel keeps the invitation and returns focus, confirm revokes once with the row id), the
unnamed title, Resend without a dialog, and an older dictionary reading the English keys. The new keys are optional in
`AuthMessages` and merged over English. The 44 px class is one ui already compiles (`min-h-11 md:min-h-0`, as in
`AppPrompts`), checked by auth's architecture test. README and CHANGELOG (`Unreleased`) agree; no version bump.

Note: the parallel mcp-access change (#1469) adds an optional app confirm component to `TokenManager`; this change
leaves that out, as the issue marks it optional and `modalClassNames` carries the app's dialog look. It can follow in
its own issue if an app asks for it.

---
change_id: auth-consent-field-588
reviewed: 2026-10-19
verdict: approved
---

# Implementation review: auth-consent-field-588

Reviewed: the branch diff against plan.md, change.md and issue #588.
Verdict: **approve** after finding 1.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Major | `ConsentProps` is named in `RegisterFormProps` but was not exported from `@softure-ai/auth/ui`, so an app could not type its own `consentProps` object. | Fixed: exported from `src/ui/index.ts`. |
| 2 | Check | Acceptance "unticked box shows the message, no bubble": the test cancels the `invalid` event (`fireEvent.invalid` returns false), finds `errors.auth.consent_required` and `aria-invalid`, and ticking clears it. | No change. |
| 3 | Check | Acceptance "`#field-consent` and `#field-consent-error`": pinned with the server's `consent` error after a submit, with no form alert (no double message). | No change. |
| 4 | Check | Acceptance "unrendered field error shows on the form": `requireConsent={false}` plus a `consent` error gives the form alert; each form lists exactly the fields it renders. | No change. |
| 5 | Check | `fieldClassNames` reaches all eight text and password fields of the five forms (one spread of `getFieldLook`); tested on RegisterForm, LoginForm, and the tooltip hint look on ChangePasswordForm. `fieldHintAs` is an addition to the issue's proposal, needed because ui applies `hintProps` to tooltip hints only. | No change. |
| 6 | Check | Existing calls: all new props optional and undefined by default, which is what the fields received before; the 406 auth tests (pages included) pass unchanged. Additive, no version bump; CHANGELOG `## Unreleased` carries the migration for the app's workaround. | No change. |
| 7 | Minor | The invalid handling duplicates ui's `CheckboxField` (about fifteen lines). | Accepted per the plan review; recorded in change.md. |

# Implementation review: billing-reminder-text-only-428

Verdict: approved (auto). No findings.

- Matches the plan: `AccessReminderTemplateMail` (`Pick<OutgoingMail, "subject" | "text" | "html">`) is the
  `buildMail` return type and is exported from `@softure-ai/billing/mailing`; `AccessReminderMail` and
  `renderAccessReminderMail` are unchanged, so `context.mail.html` stays a `string`.
- Compatibility: a template returning `AccessReminderMail` is assignable to the new type, so every existing template
  compiles. The spread `{ to, ...mail }` yields a valid `OutgoingMail` under `exactOptionalPropertyTypes`.
- Test: "sends a plain-text mail from a template that returns no HTML body" asserts the provider got `html: null`
  (exact values); it did not compile before the fix.
- Docs: README template paragraph and `## Unreleased` in the CHANGELOG; no version bump.
- Diff limited to billing's `src/mailing/`, its reminder test, README and CHANGELOG (no overlap with #426's files
  beyond the CHANGELOG's Unreleased section, which merges as two bullets).

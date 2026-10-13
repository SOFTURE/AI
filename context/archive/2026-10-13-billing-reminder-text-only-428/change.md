---
change_id: billing-reminder-text-only-428
title: "billing: sendAccessReminders' buildMail may return a plain-text mail (issue #428)"
status: archived
roadmap_item: null
issue: 428
branch: claude/project-thread-7jbz8k
created: 2026-10-13
updated: 2026-10-13
archived_at: 2026-10-13
---

## Intent

Close [issue #428](https://github.com/SOFTURE/AI/issues/428) (labels `bug`, `pkg: billing`): the `buildMail` template
of `sendAccessReminders` must return `AccessReminderMail`, whose `html` is a required string. Mailing treats `html` as
optional and rejects an empty one, so an app whose reminder is plain text has no typed way to send it. After this
change `buildMail` may return `{ subject, text }` (with an optional `html`), the mail reaches the provider with
`html: null`, and `renderAccessReminderMail` keeps its HTML body.

## Context

billing is at 0.2.1 on master. Releases are batched by the coordinator: no version bump, the CHANGELOG gets
`## Unreleased`. Issue #426 touches billing in a parallel thread; this diff stays inside the reminder mail.

## Constraints

- No change to the package's own mail or to `AccessReminderMailContext.mail` (still `html: string`), so a template that
  reads `context.mail.html` keeps compiling.
- Additive type change only: every template that compiles today still compiles.

## Notes

- Research: kept short; the issue names the type, the file and the expected test.
- Framing: skipped. The issue states the problem and the expected API.

## Decisions (auto)

- A new exported type `AccessReminderTemplateMail = Pick<OutgoingMail, "subject" | "text" | "html">` is what
  `buildMail` returns; `AccessReminderMail` (with the required `html`) stays what the package renders and what the
  template gets as `mail`. Making `AccessReminderMail.html` optional instead would turn `context.mail.html` into
  `string | undefined` and break templates that read it.
- No version bump; `## Unreleased` in the CHANGELOG (batched releases).

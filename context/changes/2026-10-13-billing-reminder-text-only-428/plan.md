---
change_id: billing-reminder-text-only-428
status: planned
---

# Plan: billing reminder template may return plain text (issue #428)

Input: change.md, research.md. Complexity: trivial (one type, one test, docs).

## Phase 1: type and test (TDD)

Files: `modules/billing/src/mailing/reminder-mail.ts`, `modules/billing/src/mailing/index.ts`,
`modules/billing/tests/reminder-mail.test.ts`.

1. Test first: a template returning `{ subject, text }` is sent, and the provider gets `html: null`. Without the fix
   the test fails typecheck (the object misses `html`).
2. Add `AccessReminderTemplateMail = Pick<OutgoingMail, "subject" | "text" | "html">`; `buildMail` returns it; export
   it from `@softure-ai/billing/mailing`.

## Phase 2: docs

`modules/billing/README.md` (template returns `{ subject, text }` and an optional `html`), `CHANGELOG.md`
`## Unreleased`.

## Progress

- [ ] Phase 1: type and test
- [ ] Phase 2: docs

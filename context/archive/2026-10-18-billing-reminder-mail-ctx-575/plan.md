---
change_id: billing-reminder-mail-ctx-575
status: archived
---

# Plan: buildMail gets the run's module context (issue #575)

Input: change.md, research.md. Complexity: small (one field, tests, docs).

## Phase 1: ctx on the template's context (TDD)

Files: `modules/billing/src/mailing/reminder-mail.ts`, `modules/billing/tests/reminder-mail.test.ts`,
`modules/billing/tests/jobs.test.ts`.

1. Tests first:
   - the exact context `buildMail` gets includes `ctx`, the context the run was called with;
   - through `createBillingJobHandlers`, a `buildMail` that reads the account from the database with `ctx.db` and
     the time from `ctx.clock` sends a mail built from both (the job's handle and test clock).
2. Add `readonly ctx: ModuleContext<Queryable>` to `AccessReminderMailContext`; pass `ctx` in `sendAccessReminders`.

## Phase 2: docs

`modules/billing/README.md` (the template's context lists `ctx`), `CHANGELOG.md` `## Unreleased` with the migration
for an app that wrapped the run in its own job handler.

## Progress

- [x] Phase 1: ctx on the template's context (84f4dbe; the job test was red before the change: the template threw on `ctx`; 29 tests in the two files pass)
- [x] Phase 2: docs (84f4dbe, committed with phase 1: README template context, CHANGELOG `## Unreleased` with the migration)

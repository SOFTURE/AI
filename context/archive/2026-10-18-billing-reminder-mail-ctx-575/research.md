---
change_id: billing-reminder-mail-ctx-575
---

# Research: the reminder template's context (issue #575)

## Findings

- `sendAccessReminders(ctx, options)` (`modules/billing/src/mailing/reminder-mail.ts`) already holds the
  `ModuleContext<Queryable>` it was called with; it calls `buildMail({ reminder, lastDay, link, mail })` and drops it.
- `createBillingJobHandlers({ reminders })` (`modules/billing/src/jobs/index.ts`) calls
  `sendAccessReminders(ctx, options.reminders)` with the job's `JobHandlerContext` (`db`, `clock`, `config`, `job`,
  `signal`), a structural superset of `ModuleContext<Queryable>`. Passing the same `ctx` to `buildMail` therefore gives
  the template the job's handle and clock with no change in the jobs entry.
- `buildMail` also runs in a dry run, so it must not write; the doc comment already says so and stays true with `ctx`.
- Tests: `tests/reminder-mail.test.ts` pins the exact context object (`toEqual`), so it gains `ctx`;
  `tests/jobs.test.ts` covers options passed through the handler and gets a case that queries through `ctx`.

## Options

1. `ctx` on `AccessReminderMailContext` (chosen): additive, one line in the run, typed as the existing
   `ModuleContext<Queryable>`.
2. `reminders` as `(ctx) => options`: a union type in the jobs entry and a second way to configure; not needed.

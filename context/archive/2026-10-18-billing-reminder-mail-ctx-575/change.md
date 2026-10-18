---
change_id: billing-reminder-mail-ctx-575
title: "billing: buildMail gets the run's module context (issue #575)"
status: archived
roadmap_item: null
issue: 575
branch: claude/project-thread-uqrltu
created: 2026-10-18
updated: 2026-10-18
archived_at: 2026-10-18
---

## Intent

Close [issue #575](https://github.com/SOFTURE/AI/issues/575): a reminder template passed through
`createBillingJobHandlers({ reminders })` cannot reach the job's database handle, clock or config, so an adopting app
that checks the account at send time wraps the run in its own job handler instead of using the package's.

## Context

Labels: `enhancement`, `adoption`, `pkg: billing`. billing 0.7.0 is the latest on npm and on master. Releases are
batched by the coordinator: no version bump here, the CHANGELOG gets `## Unreleased`.

## Constraints

- Existing `reminders` objects and `sendAccessReminders` callers keep working unchanged.
- A `buildMail` used through the job handler queries with the same handle and clock the job uses.

## Notes

- Framing: skipped. The issue states the problem, two proposals and the acceptance.

## Decisions (auto)

- Take the issue's first proposal: `AccessReminderMailContext` gains `ctx`, the module context the run was given
  (`sendAccessReminders(ctx, ...)`; in the job handler that is the job's context). It is additive, needs no new
  option and serves direct callers too. The second proposal (`reminders` as a function) is not needed for the
  acceptance and is left out.

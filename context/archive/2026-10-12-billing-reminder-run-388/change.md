---
change_id: billing-reminder-run-388
title: "billing: sendAccessReminders runs on mailing's runDeliveries and carries the exact end (issue #388)"
status: archived
roadmap_item: null
issue: 388
branch: claude/project-thread-rwea85
created: 2026-10-12
updated: 2026-10-12
archived_at: 2026-10-12
---

## Intent

Close [issue #388](https://github.com/SOFTURE/AI/issues/388): an app moving from its own reminder job to
`sendAccessReminders` cannot reproduce that job's delivery scopes (built in SQL from `timestamptz`, microseconds
included), so accounts with a non-zero microsecond end would be mailed twice; and the run has no dry run, `limit`,
`retakeUncertain` or `onDelivery`. After this change every due reminder carries its end exactly as stored, and
`sendAccessReminders` is a `runDeliveries` run that takes those options and returns its summary.

## Context

Issue #388 (labels `bug`, `adoption`, `pkg: billing`), no roadmap item. `@softure-ai/billing` 0.1.11 and
`@softure-ai/mailing` 0.1.12 are on npm; the change goes under `## Unreleased` in billing's CHANGELOG and rides the
next release (no version bump here). Builds on #394 (merged, PR #397): `runDeliveries` stops at the first
`retry-later` by default.

## Constraints

- Owned: `modules/billing/` only (mailing is used as is).
- The package's default scope must not change: apps on 0.1.11 have ledger entries under it.
- No address in any output; English-only code and docs; no names of adopting apps.

## Notes

- Research: skipped. The issue names the functions and the gaps; the code it touches (`reminder-mail.ts`,
  `reminders.ts`, mailing's `run-deliveries.ts`) is read in plan.md.
- Framing: skipped, the problem is observed by an adopter.

## Decisions (auto)

- The exact end is a new field `endsAtMicros` on `AccessReminderDue`: microseconds since the Unix epoch as a decimal
  string, read in SQL with `(extract(epoch from <column>) * 1000000)::bigint::text`. A string because the number
  passes `Number.MAX_SAFE_INTEGER` precision only by a small margin and a scope is text anyway; not `::text` of the
  timestamp, whose form depends on the session's `TimeZone` and `DateStyle`. A derived trial end (no row) has no
  microseconds: `endsAt` in milliseconds times 1000.
- The default scope `billing.<kind>:<user>:<ms>` stays: changing it would mail every account an earlier version
  already mailed. An app that wants microseconds passes `getScope`.
- `sendAccessReminders` is built on `runDeliveries`; its options extend `RunDeliveriesOptions` (`dryRun`, `limit`,
  `retakeUncertain`, `onDelivery`, `stopOnRetryLater`, the claim windows) with `pauseMs` defaulting to 500 as before.
  The summary is `DeliveryRunSummary` plus `due`. This changes the summary's shape (`rejected` by reason, `done`,
  `inFlight`, `uncertain` and `halted` instead of one `skipped`), a breaking change for a 0.x package that the
  issue asks for; the CHANGELOG says so.
- The mailing peer range rises to `^0.1.12` (the first version with `runDeliveries`).

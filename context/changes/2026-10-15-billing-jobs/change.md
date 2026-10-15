---
change_id: billing-jobs
title: "Billing runs its access reminders and invoice request expiry as jobs schedules (issue #490)"
status: research
roadmap_item: null
issue: 490
branch: claude/project-thread-swbd1r
created: 2026-10-15
updated: 2026-10-15
---

## Intent

An app with `@softure-ai/jobs` runs billing's access reminder mail and the expiry of stale invoice requests by adding
billing's ready job handlers and schedules to its jobs config, instead of writing two scripts and a cron for them. A
mail outage during a reminder run is retried with the queue's backoff, a refused sending account fails the run, and
the next period resumes either way.

## Context

- Issue #490 (labels `enhancement`, `pkg: billing`), a follow-up of #471 (`@softure-ai/jobs`) that waited for #491
  (jobs schedules, merged, released in jobs 0.1.1).
- Today the billing README tells every app to add `scripts/send-access-reminders.ts` and
  `scripts/expire-invoice-requests.ts` to a cron. A missed cron fails silently and a run hit by a mail outage has no
  retry of its own.
- The pattern to follow: the `./jobs` entries of auth, security, waitlist, mcp-access and analytics (#491).

## Constraints

- Owns `modules/billing/` only (a new `./jobs` entry, package manifest, README, CHANGELOG, tests). Does not touch any
  adopting app; the migration is described in the CHANGELOG and the issue.
- `sendAccessReminders` and `expireStaleRequests` stay as they are: apps without jobs keep their cron.
- `@softure-ai/jobs` becomes an optional peer (`^0.1.1`), like in the other packages; `@softure-ai/mailing` stays
  optional too, so the jobs entry must load in an app without mailing.
- PR #485 (billing usage limits) also changes billing's README, CHANGELOG and manifest; merge master in after it lands.
- No release in this change (the coordinator releases). Everything in English.

## Notes

- Framing: skipped. The issue names the problem and the asks; the owner ordered the refactor.

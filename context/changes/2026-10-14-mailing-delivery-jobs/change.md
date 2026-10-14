---
change_id: mailing-delivery-jobs
title: "Mail deliveries retry through a jobs handler instead of the caller calling again (issue #492)"
status: in-progress
roadmap_item: null
issue: 492
branch: claude/project-thread-an8as2
created: 2026-10-14
updated: 2026-10-14
---

## Intent

An app that sends a mail from a request path enqueues the delivery in its own transaction and lets the jobs worker
send it, with retries on a provider outage (honouring the provider's `Retry-After`), instead of calling
`deliverOnce` again by hand or losing the mail when it never does. The delivery ledger stays the at-most-once guard.

## Context

- Issue #492 (labels `enhancement`, `pkg: mailing`), follow-up of #471 (`@softure-ai/jobs`, PR #482).
- Runs next to #491 (jobs schedules, owns `modules/jobs/`) and #494 (auth and waitlist mails through jobs, which
  needs id-only payloads and is the first consumer of this API).

## Constraints

- Owns `modules/mailing/`. Does not touch `modules/jobs/`, auth or waitlist.
- `@softure-ai/jobs` is an optional peer: an app without jobs keeps `deliverOnce` with its own attempt counting.
- No release in this change; the coordinator releases. No change to any adopting app; the migration is written in
  the CHANGELOG, the README and the issue's closing comment.
- Everything in English.

## Notes

- Framing: skipped. The issue names the problem and the shape of the solution.

---
change_id: auth-waitlist-mail-jobs
title: "Auth and waitlist send their transactional mails through jobs when the app runs a worker (issue #494)"
status: archived
roadmap_item: null
issue: 494
branch: claude/project-thread-pizoe9
created: 2026-10-14
updated: 2026-10-14
archived_at: 2026-10-14
---

## Intent

Close [issue #494](https://github.com/SOFTURE/AI/issues/494). The password reset mail of `@softure-ai/auth` and the
double opt-in confirmation mail of `@softure-ai/waitlist` are sent inside the request (in `after()`): a provider
outage loses the mail, and nothing retries it. When the app uses `@softure-ai/jobs`, both mails are enqueued in the
request (the waitlist in the sign-up's own transaction) and sent by a job handler with retry and backoff; without
jobs, the current path stays.

## Context

Issue #494 (labels `enhancement`, `pkg: auth`, `pkg: waitlist`), follow-up of #471 (`@softure-ai/jobs`, PR #482).
Asks: enqueue in the same transaction as the token or sign-up row and send from a handler with retry; keep the
synchronous path without jobs (optional peer dependency); tokens and links stay valid for the retry window and
payloads carry ids only; READMEs and CHANGELOGs with migration notes.

Parallel work: #491 moves the prune functions of auth and waitlist onto jobs, #492 adds a mailing delivery job.

## Constraints

- Owns `modules/auth/` and `modules/waitlist/` (password reset, confirmation mail, options, entries, docs). No
  change to `modules/jobs/` or `modules/mailing/`.
- Additive: an app that passes no enqueuer behaves exactly as before.
- No change in any adopting app's repository; the migration goes into the CHANGELOGs, READMEs and the issue.
- No version bump: releases are batched by the coordinator; CHANGELOGs get `Unreleased` entries.

## Notes

- Placement: unlinked one-off from the issue queue (`autonomy.source: issues`), `roadmap_item: null`.
- Framing: skipped. The issue names the problem and the asks; nothing about the problem is in doubt.
- Archived 2026-10-14: auth and waitlist send their reset and confirmation mails from jobs when the app passes an enqueuer; ships in the next auth and waitlist releases.

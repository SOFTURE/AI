---
change_id: mailing-adoption-gaps
title: "mailing: provider refusal and quota, legacy unsubscribe links, recipient filter, uncertain claims (issue #195)"
status: archived
roadmap_item: null
issue: 195
branch: claude/project-thread-lqx6iv
created: 2026-10-07
updated: 2026-10-07
archived_at: 2026-10-07
---

## Intent

Close every point of [issue #195](https://github.com/SOFTURE/AI/issues/195), so an adopting app can move its list and
campaign code onto `@softure-ai/mailing`, not only its transport:

1. a failed send keeps the provider's HTTP status (`SendMailResult` failure carries `httpStatus`; the ledger stores it);
2. a refused key or account (401/403) and a spent quota (429 that is not a rate limit) get their own codes,
   `mailing.provider_refused` and `mailing.quota_exceeded`: the delivery stays retryable and a campaign stops at once;
3. links an app sent before adopting the module keep working, through a `legacyUnsubscribe` hook that verifies them;
4. campaigns take a recipient filter (e.g. a consent scope) from the module options;
5. the stale-claim window is configurable, and a claim older than a second window ("uncertain": a send may have gone
   out and the provider's idempotency key may have expired) is never retaken unless the operator says so.

A reviewer checks the mailing tests (send-mail, resend, deliveries, campaigns, cli, next-unsubscribe, suppressions),
the new migration, the README and the CHANGELOG.

## Context

Issue #195, filed while an adopting app planned its switch to the packages. Work is tracked in GitHub Issues, not in a
roadmap: no roadmap item; the PR closes the issue.

## Constraints

- Scope: `modules/mailing`, plus `modules/billing`'s reminder loop (it consumes `DeliveryOutcome` and must handle the
  two new outcomes). No other thread changes mailing or billing now.
- Migrations move forward only and say how to roll back.
- Nothing of a mail (address, subject, body, link values) reaches a log, an error or a result.
- English-only code and docs; Polish copy only in `messages/pl.ts`.

## Process notes

- Research: skipped as a separate file. The issue cites file and line for points 1-2, and the reading of
  `send-mail.ts`, `resend.ts`, `deliveries.ts`, `campaigns.ts`, `suppressions.ts`, the unsubscribe page, action and
  route (master `518ef61`) confirmed every point; the findings are in plan.md's "Today" section.
- Framing: skipped. Each point is an observed gap with a fix the adopter named; point 5's "uncertain" rule follows
  from the provider's 24 h idempotency window, which the current 15-minute retake outlives.

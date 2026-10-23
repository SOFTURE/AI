---
change_id: billing-access-changed-hook-696
title: "billing: a hook when access is granted, refunded or extended, and the account in onDelivery (issue #696)"
status: archived
roadmap_item: null
issue: 696
branch: claude/project-thread-3in7ns
created: 2026-10-23
updated: 2026-10-23
archived_at: 2026-10-23
---

## Intent

Close [issue #696](https://github.com/SOFTURE/AI/issues/696). An adopting app records analytics events per account
and cannot observe two billing facts without reaching into the package:

1. A grant, a refund (or a revoked grant) and a trial extension give the app no callback. Add an optional
   `billing({ onAccessChanged })` hook, called after the change's transaction commits; a hook that throws is logged
   and never fails the change.
2. `sendAccessReminders`' `onDelivery` reports the outcome but not the account, so the app pairs it with the last
   `buildMail` call. Pass `{ accountId, kind, scope }` as a second argument.

## Context

Labels: `enhancement`, `pkg: billing`, `adoption`. Base: master at c9eaf67 (billing 0.9.1 released in PR #695). No
release in this change: the coordinator releases billing in the next combined release.

## Constraints

- Additive only: an app without the hook, and an `onDelivery` taking one argument, keep working unchanged.
- The hook runs after the commit, never inside the transaction, and its failure is logged without the account's data.
- No change to `@softure-ai/mailing` (its range in billing stays `^0.2.0`).

## Notes

- Framing: skipped. The issue names the problem and proposes the API.

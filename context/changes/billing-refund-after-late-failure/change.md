---
change_id: billing-refund-after-late-failure
title: "A new refund is not lost when an earlier refund's failure arrives late"
status: in_progress
roadmap_item: FU-35
branch: claude/project-thread-m9szln
created: 2026-10-04
updated: 2026-10-04
archived_at: null
---

## Intent

When Stripe reports a new refund of a payment (`charge.refunded`) before billing has heard that an
earlier refund of it failed (`refund.failed` delivered late), billing keeps that newer charge state,
and the late failure applies it: the new refund takes back its share once. A unit test with signed
webhook fixtures delivers the two events in that order.

Input: [`backlog-input.md`](backlog-input.md) (roadmap item FU-35).

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **FU-35** (roadmap `followups`):

> - **Outcome:** A charge state that reports less than billing recorded but is newer than the state it recorded (a failure billing has not heard of yet) is kept, and the failure that follows applies it: the new refund takes back its share once.
> - **Unknowns:** Store the newest reported state (`amount_refunded`, `created`) beside the applied one, or re-read the charge from Stripe when a failure arrives; how the take-back of the newer refund runs inside `failRefund`'s transaction.
> - **Source:** FU-30 `billing-failed-refund-access` impl review; `modules/billing/src/server/payments.ts` (`refundPayment`, `failRefund`)

## Constraints

- Owns: `refundPayment` and `failRefund` in `modules/billing/src/server/payments.ts`, a new billing
  migration (`0009`), `src/schema.ts`, the billing README and the example app's migration ledger
  expectation (lane C, after FU-34).
- Behaviour FU-30 pinned stays: a stale charge state (older than the one recorded) changes nothing,
  a repeated delivery changes nothing, a failure billing never counted gives back nothing.
- No real Stripe: signed webhook fixtures only. A gap found here is filed as a new FU item, not
  fixed (owner decision 2026-10-03). English only. No release, tag or publish (owner).

## Notes

- Research: kept, short. The item names two designs; which one works depends on what billing can
  reach from a webhook (no Stripe client in the module) and on how `refundPayment` and `failRefund`
  read the charge state today, checked on `master` (0123ea2).
- Framing skipped: the problem is a documented limitation (README §12, FU-30 impl review) with file
  references and an outcome the roadmap states; nothing about the problem is in doubt, only how
  to close it.

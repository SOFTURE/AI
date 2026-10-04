---
change_id: billing-refund-after-late-failure
title: "A new refund is not lost when an earlier refund's failure arrives late"
status: backlog
roadmap_item: FU-35
branch: null
created: 2026-10-04
updated: 2026-10-04
archived_at: null
---

## Intent

When Stripe reports a new refund of a payment (`charge.refunded`) before billing has heard that an
earlier refund of it failed (`refund.failed` delivered late), the new refund still takes back its
share once the failure arrives; a unit test with signed webhook fixtures delivers the two events in
that order.

## Context

From [`roadmap.md`](../../../foundation/roadmap.md), item **FU-35** (roadmap `followups`):

> ### FU-35: A new refund is not lost when an earlier refund's failure arrives late
> - **Change ID:** `billing-refund-after-late-failure`
> - **Status:** proposed
> - **Outcome:** A charge state that reports less than billing recorded but is newer than the state it recorded (a failure billing has not heard of yet) is kept, and the failure that follows applies it: the new refund takes back its share once.
> - **Prerequisites:** FU-34 on `master` (lane C).
> - **Unknowns:** Store the newest reported state (`amount_refunded`, `created`) beside the applied one, or re-read the charge from Stripe when a failure arrives; how the take-back of the newer refund runs inside `failRefund`'s transaction.
> - **Risk:** LOW. Needs a refund failure delivered after a later refund's own event, days apart; Stripe sends `refund.failed` when the bank refuses, usually before any new refund of the same payment.
> - **Baseline:** FU-30 `billing-failed-refund-access`: a newer charge state with a lower total is `duplicate` (only higher totals are applied), so a refund it carries is dropped when the earlier failure arrives after it (`modules/billing/README.md` §12). After: the gap is closed and covered by unit tests.
> - **Source:** FU-30 `billing-failed-refund-access` impl review; `modules/billing/src/server/payments.ts` (`refundPayment`, `failRefund`)

## Constraints

- Owns: `refundPayment` and `failRefund` in `modules/billing/src/server/payments.ts` and a billing migration if needed (lane C, after FU-34).
- No real Stripe: signed webhook fixtures only. English only. No release, tag or publish (owner).

## Notes

- Filed by FU-30 (`billing-failed-refund-access`, 2026-10-04): a README §12 limitation it leaves open.

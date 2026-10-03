---
change_id: billing-partial-refunds
title: "Partial refunds take back access by a policy"
status: backlog
roadmap_item: FU-20
branch: null
created: 2026-10-03
updated: 2026-10-03
archived_at: null
---

## Intent

A partial refund of a provider payment changes the account's access by a documented policy (for
example the same share of the payment's unused days as the share of the amount refunded), and
several partial refunds that add up to the full amount behave like one full refund.

## Context

From [`roadmap.md`](../../../foundation/roadmap.md), item **FU-20** (roadmap `followups`):

> ### FU-20: Partial refunds take back access by a policy
> - **Change ID:** `billing-partial-refunds`
> - **Status:** proposed
> - **Outcome:** A partial refund changes access by a documented policy; partial refunds summing to the full amount act like one full refund.
> - **Prerequisites:** FU-11 on `master` (payments record their grant).
> - **Unknowns:** Pro rata by amount vs. a fixed rule; rounding of days; tracking the refunded amount per payment (`charge.amount_refunded`); whether the policy is an option of `billing()`.
> - **Risk:** LOW.
> - **Baseline:** FU-11 `billing-refund-one-payment`: `charge.refunded` with `refunded: false` is ignored (README §12). After: a partial refund follows the policy, covered by unit tests with signed webhook fixtures.
> - **Source:** FU-11 (the optional half of its outcome, deferred in its research); `modules/billing/README.md` §12

## Constraints

- Owns: `modules/billing/` refunds and, if needed, a billing migration (lane C).
- No real Stripe; signed webhook fixtures only.

## Notes

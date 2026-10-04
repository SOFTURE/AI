---
change_id: billing-failed-refund-access
title: "A refund that fails gives back the access it took"
status: backlog
roadmap_item: FU-30
branch: null
created: 2026-10-04
updated: 2026-10-04
archived_at: null
---

## Intent

When a provider refund fails after billing acted on it (Stripe `refund.failed`, or a `charge.refunded`
whose `amount_refunded` drops again), the account gets back the access the refund took, and the
payment's recorded refunded total and status follow the provider's.

## Context

From [`roadmap.md`](../../../foundation/roadmap.md), item **FU-30** (roadmap `followups`):

> ### FU-30: A refund that fails gives back the access it took
> - **Change ID:** `billing-failed-refund-access`
> - **Status:** proposed
> - **Outcome:** A failed provider refund restores the access the refund took back and the payment's refunded total and status.
> - **Prerequisites:** FU-27 on `master` (lane C).
> - **Unknowns:** Which Stripe event to trust (`refund.failed` vs. a lower cumulative `amount_refunded` on `charge.refunded` or `charge.refund.updated`); how to give back days when other grants moved in between (extend by the days taken, as a grant at the end); whether a failed refund of a lifetime restores lifetime.
> - **Risk:** LOW. Failed refunds are rare (a closed card or bank account), and the owner sees them in Stripe.
> - **Baseline:** FU-20 `billing-partial-refunds`: a lower cumulative `amount_refunded` is a stale delivery and changes nothing; a full refund keeps the payment `refunded` (README §12). After: the gap is closed and covered by unit tests with signed webhook fixtures.
> - **Source:** FU-20 research ("Risks"); `modules/billing/README.md` §12

## Constraints

- Owns: `modules/billing/` refunds (lane C).
- No real Stripe; signed webhook fixtures only.

## Notes

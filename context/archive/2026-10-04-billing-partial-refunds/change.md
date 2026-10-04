---
change_id: billing-partial-refunds
title: "Partial refunds take back access by a policy"
status: archived
roadmap_item: FU-20
branch: claude/fu-20-ke8s4w
created: 2026-10-04
updated: 2026-10-04
archived_at: 2026-10-04
---

## Intent

A partial refund of a provider payment changes the account's access by a documented policy that the
app can choose in `billing()`, and several partial refunds that add up to the payment's full amount
leave the account exactly where one full refund would. A repeated or out-of-order delivery of a
partial refund changes nothing twice. Unit tests with signed Stripe webhook fixtures cover it.

Input: [`backlog-input.md`](backlog-input.md) (roadmap item FU-20).

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **FU-20** (roadmap `followups`):

> ### FU-20: Partial refunds take back access by a policy
> - **Change ID:** `billing-partial-refunds`
> - **Status:** proposed
> - **Outcome:** A partial refund changes access by a documented policy; partial refunds summing to the full amount act like one full refund.
> - **Prerequisites:** FU-11 on `master` (payments record their grant); runs in lane C after FU-6 (shared files).
> - **Unknowns:** Pro rata by amount vs. a fixed rule; rounding of days; tracking the refunded amount per payment (`charge.amount_refunded`); whether the policy is an option of `billing()`.
> - **Risk:** LOW.
> - **Baseline:** FU-11 `billing-refund-one-payment`: `charge.refunded` with `refunded: false` is ignored (README §12). After: a partial refund follows the policy, covered by unit tests with signed webhook fixtures.
> - **Source:** FU-11 (the optional half of its outcome, deferred in its research); `modules/billing/README.md` §12

The roadmap's owner assessment (Owner at the keyboard?): "a refund policy in billing with a
documented default; signed webhook fixtures, no Stripe secrets".

Today `readRefund` (`modules/billing/src/stripe-webhook.ts`) returns `ignored` ("a partial refund")
for `charge.refunded` with `refunded: false`, and `modules/billing/README.md` §12 says "A partial
refund changes nothing (followups FU-20)".

## Constraints

- Owns `modules/billing/` refunds (webhook parsing, `refundPayment`, the take-back, the option, the
  admin history line, the export), a billing migration if needed, and the e2e ledger line for it.
- Lane C (billing): FU-21, FU-22 and later billing items follow in `modules/billing/`; none of them
  is done here. Other gaps found go to the followups roadmap as new FU items, not fixed here.
- No real Stripe: signed webhook fixtures only.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in the `pl`/`en`
  message dictionaries.
- No release, tag or publish (owner).

## Notes

- Framing skipped: the gap is recorded with a stated outcome and an owner assessment ("a refund
  policy with a documented default"); it is not bug-shaped and its scope is not in doubt. Research
  answers the four unknowns.
- Archived 2026-10-04: a partial refund records Stripe's cumulative `amount_refunded` (`billing.payments.refunded_amount`, migration `0005`) and, under the default `partialRefunds: "pro_rata"`, takes back the refunded share of the payment's unused days; partial refunds summing to the amount end where one full refund does; `keep_access` takes nothing until the completing refund.

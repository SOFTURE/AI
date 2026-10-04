---
change_id: billing-failed-refund-access
title: "A refund that fails gives back the access it took"
status: implemented
roadmap_item: FU-30
branch: claude/project-thread-8sum2d
created: 2026-10-04
updated: 2026-10-04
archived_at: null
---

## Intent

When a provider refund fails after billing acted on it (the bank or card refuses it, Stripe reports
`refund.failed`), the account gets back the access that refund took, and the payment's recorded
refunded total and status follow the provider's again. A repeated, stale or out-of-order delivery
changes nothing twice. Unit tests with signed Stripe webhook fixtures cover it.

Input: [`backlog-input.md`](backlog-input.md) (roadmap item FU-30).

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **FU-30** (roadmap `followups`):

> ### FU-30: A refund that fails gives back the access it took
> - **Change ID:** `billing-failed-refund-access`
> - **Status:** proposed
> - **Outcome:** A failed provider refund restores the access the refund took back and the payment's refunded total and status.
> - **Prerequisites:** FU-27 on `master` (lane C).
> - **Unknowns:** Which Stripe event to trust (`refund.failed` vs. a lower cumulative `amount_refunded` on `charge.refunded` or `charge.refund.updated`); how to give back days when other grants moved in between (extend by the days taken, as a grant at the end); whether a failed refund of a lifetime restores lifetime.
> - **Risk:** LOW. Failed refunds are rare (a closed card or bank account), and the owner sees them in Stripe.
> - **Baseline:** FU-20 `billing-partial-refunds`: a lower cumulative `amount_refunded` is a stale delivery and changes nothing; a full refund keeps the payment `refunded` (README §12). After: the gap is closed and covered by unit tests with signed webhook fixtures.
> - **Source:** FU-20 research ("Risks"); `modules/billing/README.md` §12

The roadmap's owner assessment (Owner at the keyboard?): "no: a billing webhook path with signed
fixtures; no Stripe secrets".

Today `parseStripeEvent` (`modules/billing/src/stripe-webhook.ts`) acts on `charge.refunded` only;
`refundPayment` (`src/server/payments.ts`) treats a cumulative total not above the stored one as
`duplicate`, and README §12 lists the failed refund as a limitation.

## Constraints

- Owns `modules/billing/` refunds (webhook parsing, `refundPayment`, the take-back, a new billing
  migration `0007`), the billing README, and the e2e ledger line and Stripe e2e payloads that the
  migration and the parser change touch.
- Lane C (billing): FU-32, FU-33 and FU-34 follow in `modules/billing/`; none of them is done here.
  Other gaps found go to the followups roadmap as new FU items, not fixed here.
- No real Stripe: signed webhook fixtures only.
- English-only code, comments and commits (AGENTS.md). No release, tag or publish (owner).

## Notes

- Framing skipped: the gap is stated with its outcome, baseline and the unknowns to answer; it is
  not in doubt and not bug-shaped beyond the documented limitation. Research answers the unknowns.

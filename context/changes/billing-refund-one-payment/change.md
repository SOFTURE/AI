---
change_id: billing-refund-one-payment
title: "Refunds that take back one payment's period"
status: impl_reviewed
roadmap_item: FU-11
branch: claude/project-thread-wsh2og
created: 2026-10-03
updated: 2026-10-03
archived_at: null
---

## Intent

When a provider reports a full refund of one payment, the account loses only the access that
payment granted: the length of its paid period, or the lifetime it bought. Other stacked periods,
a separately bought lifetime and grants the admin made by hand stay. An operator can check it in
`billing.entitlements` after a `charge.refunded` delivery.

Input: [`backlog-input.md`](backlog-input.md) (roadmap item FU-11).

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **FU-11** (roadmap `followups`):

> - **Outcome:** A full refund removes only the access the refunded payment granted (its period, or the lifetime it bought), not every paid period of the account; optionally partial refunds handled by a policy.
> - **Unknowns:** Storing each payment's granted start and end in `billing.payments`; a shortening entitlement event vs. recomputing access from the remaining payments; how manual grants (no payment row) count.
> - **Risk:** MEDIUM.
> - **Baseline:** monetization MO-3 `billing-provider-adapter`: `charge.refunded` revokes all paid access (`revoke`), so a refund of one of two stacked months, or of a monthly payment next to a lifetime, takes everything (README §12, plan review W4). After: the gap is closed and covered by unit and e2e tests.

Today `refundPayment` (`modules/billing/src/server/payments.ts`) applies `{ type: "revoke" }`, which
clears `paid_until` and `is_lifetime` (`modules/billing/src/entitlement.ts`).

## Constraints

- Exclusively owns: `modules/billing/` refunds and a new billing migration (lane C: FU-9 and FU-6
  follow and must not be started here).
- Parallel items FU-1, FU-3, FU-14 own other modules; `examples/next-app/e2e/migrations.spec.ts`
  may conflict with FU-3 (master wins, merge it in).
- No real Stripe: signed webhook fixtures only; the sandbox payment end to end is LT-1.
- English-only code; no release, tag or publish (owner).

## Notes

- Framing skipped: the problem is stated by the roadmap item and the MO-3 plan review W4 with its
  intended fix (store the grant per payment, a shortening event); research is enough to settle
  the remaining unknowns.
- Partial refunds (the optional half of the outcome) stay ignored unless research finds a cheap,
  safe policy; if not, they stay a README limitation.

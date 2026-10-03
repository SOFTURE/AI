---
change_id: billing-provider-adapter
title: "Payment provider adapter (Stripe)"
status: plan_reviewed
roadmap_item: MO-3
branch: claude/mo-3-billing-stripe-0aam5s
created: 2026-10-03
updated: 2026-10-03
archived_at: null
---

## Intent

Card and online-transfer payments through Stripe (the owner's choice, 2026-10-03): `stripe()` is a
`PaymentProvider` that opens a Stripe Checkout session for a plan, and a verified webhook route turns
a paid session into access (`grantPlan`) and a full refund into revoked access, exactly once per
payment, recorded in `billing.payments`.

Input: [`backlog-input.md`](backlog-input.md) (roadmap item MO-3).

## Scope

- `stripe({ secretKey, apiBase, fetch })` in the root entry: one-time Checkout sessions
  (`mode: "payment"`, the plan's price in minor units, the account's id and plan id in metadata),
  success and cancel URLs back to the payment page; no SDK, Stripe's HTTP API through `fetch`.
- Pure webhook verification (`Stripe-Signature`, HMAC-SHA256, 5-minute tolerance, several `v1`
  signatures during a secret rotation) and event parsing with zod into a discriminated union.
- Migration `0002_create_payments.sql`: one row per paid checkout, unique per provider and checkout
  and per provider and payment; status `paid` / `refunded`.
- `/server`: `recordPayment` (insert-or-skip and the grant in one transaction), `refundPayment`
  (conditional update and a revoke in one transaction); privacy export and deletion of payments;
  the health check reads both tables.
- `/next`: `stripeWebhookRoute` (POST; 400 for a bad signature, 200 once handled, also again, 500
  on a database failure so Stripe retries); the payment page's notice after a checkout returns.
- Example: `app/api/billing/webhook/route.ts`, `BILLING_PROVIDER=stripe` picks `stripe()`;
  `e2e/billing-stripe.spec.ts` with signed webhook fixtures. A sandbox test of the Checkout API runs
  only when `STRIPE_SECRET_KEY` is set.

## Out of scope

- Subscriptions (recurring billing): one-time payments avoid a second clock next to the plan period.
- Partial refunds, and undoing exactly one period when several are stacked (followups).
- Stripe invoices and tax id collection.

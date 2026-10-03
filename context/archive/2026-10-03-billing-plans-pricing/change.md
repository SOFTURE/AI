---
change_id: billing-plans-pricing
title: "Plans, pricing tiles and the manual payment flow"
status: archived
roadmap_item: MO-2
branch: claude/mo-2-billing-plans-pricing-ivvxjw
created: 2026-10-03
updated: 2026-10-03
archived_at: 2026-10-03
---

## Intent

Apps sell access from `softure.config.ts`: `billing({ plans })` declares each plan (name, price in
the currency's minor unit, period, features), `PricingTiles` and the payment page show them, and the
first payment adapter, `manual({ onRequest })`, lets a buyer request an invoice that the owner turns
into access with a plan grant in an admin page guarded by auth roles. `PaymentProvider` is the
contract MO-3's Stripe adapter implements; `grantPlan` is the one path a grant takes.

Input: [`backlog-input.md`](backlog-input.md) (roadmap item MO-2).

## Scope

- Options: `plans` (period shorthand or `{ unit, count }`, ISO 4217 currency, unique ids),
  `payment` (a `PaymentProvider`), `adminRole`; `BILLING_RATE_LIMIT_BUCKETS` (`billing-payment`).
- Pure: `getPeriodEnd` (local calendar days, month-end clamp), `getPlanGrant` (a period starts where
  access ends), `formatPrice` (`Intl`, minor units), `formatPeriod` (plural copy).
- `/server`: `grantPlan` (under the entitlement's lock, through `changeEntitlement` with an event
  resolver), `startPayment` (bucket first, plan, invoice details, provider), `findAccountByEmail`.
- `/ui`: `PricingTiles`, `PaymentForm`, `GrantForm`. `/next`: `Pricing`, `PaymentPage`,
  `BillingAdminPage`, `startPaymentAction`, `grantPlanAction`.
- Example: `/pricing`, `/payment`, `/admin/billing`, invoice requests mailed to the admin;
  `e2e/billing-pricing.spec.ts`.

## Out of scope

- A card or transfer provider and webhooks (MO-3, Stripe).
- Stored payment requests, revoke and grant history in the admin page (followups).

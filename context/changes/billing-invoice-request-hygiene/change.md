---
change_id: billing-invoice-request-hygiene
title: "Invoice requests are stored before the owner hears of them and keep only what they need"
status: impl_reviewed
roadmap_item: FU-27
branch: claude/fu-27-invoice-request-hygiene-y4gxer
created: 2026-10-04
updated: 2026-10-04
archived_at: null
---

## Intent

The manual invoice flow is safe to retry and keeps no more personal data than it needs. A request
is stored before the provider hands it to the owner (the owner's mail), and the owner hears of an
open request once: asking again only refreshes it, and a hand-over that failed is tried again on
the next ask. Invoice fields are parsed by a zod schema that refuses control characters, so a name
cannot add lines to the owner's mail, and each field says whether it is missing, too long or has
characters it may not have. Open requests older than a configurable age are closed with their
details cleared. Requests and manual grants record the plan's amount and currency, so the admin
sees what was quoted and granted after a price change.

Input: [`backlog-input.md`](backlog-input.md) (roadmap item FU-27).

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **FU-27** (roadmap `followups`):

> - **Outcome:** A manual invoice request is stored before it is handed to the provider (the owner's mail), a refresh of an open request does not mail the owner again, invoice fields are parsed by a zod schema that refuses control characters, a too-long field gets its own message, open requests older than a configurable age are closed with their details cleared, and requests and manual grants record the plan's amount and currency.
> - **Unknowns:** The default age for closing a stale request; whether the price snapshot needs a migration `0005` on both tables (likely) and how existing rows are left (NULL).
> - **Source:** FU-12 retro plan review of MO-2, S1-S4 (`context/archive/2026-10-03-billing-plans-pricing/reviews/plan-review.md`); `modules/billing/src/server/plans.ts`, `src/fields.ts`, `migrations/0004_create_requests_and_grants.sql`

Known current state: `startPayment` calls `provider.startPayment` and only then
`recordPaymentRequest` (`modules/billing/src/server/plans.ts:135-136`); `parseInvoiceDetails` is
hand-written with one code for every field problem (`plans.ts:91-101`); migration `0005` is taken
by FU-20 (`0005_record_refunded_amounts.sql`), so the next one is `0006`.

## Constraints

- Owns: `modules/billing/` requests (`src/server/requests.ts`, `src/server/plans.ts`,
  `src/server/grants.ts`), the payment contract (`src/payment.ts`, `src/manual.ts`,
  `src/stripe.ts`), invoice fields, migration `0006`, the error messages, the admin page rows, the
  example app's request mail and e2e (`examples/next-app/e2e/billing-pricing.spec.ts`,
  `e2e/migrations.spec.ts`). Lane C: FU-30, FU-32 and FU-33 are not done here.
- A gap found here is filed as a new FU item, not fixed (owner decision 2026-10-03).
- English only. No release, tag or publish (owner).

## Notes

- Research: kept. The item names two unknowns (default age, migration and old rows), and storing
  before the hand-over changes what a failed hand-over leaves behind, which decides the design.
- Framing skipped: the problem is stated by four retro findings (S1-S4) with file references and
  checked against `master` today; nothing about the problem is in doubt, only how to close it.

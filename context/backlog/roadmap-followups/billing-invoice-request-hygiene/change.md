---
change_id: billing-invoice-request-hygiene
title: "Invoice requests are stored before the owner hears of them and keep only what they need"
status: backlog
roadmap_item: FU-27
branch: null
created: 2026-10-04
updated: 2026-10-04
archived_at: null
---

## Intent

A manual invoice request is stored before it is handed to the provider (the owner's mail), a refresh of an open request does not mail the owner again, invoice fields are parsed by a zod schema that refuses control characters, a too-long field gets its own message, open requests older than a configurable age are closed with their details cleared, and requests and manual grants record the plan's amount and currency.

## Context

From [`roadmap.md`](../../../foundation/roadmap.md), item **FU-27** (roadmap `followups`):

> - **Outcome:** A manual invoice request is stored before it is handed to the provider (the owner's mail), a refresh of an open request does not mail the owner again, invoice fields are parsed by a zod schema that refuses control characters, a too-long field gets its own message, open requests older than a configurable age are closed with their details cleared, and requests and manual grants record the plan's amount and currency.
> - **Prerequisites:** FU-26 on `master` (lane C).
> - **Unknowns:** The default age for closing a stale request; whether the price snapshot needs a migration `0005` on both tables (likely) and how existing rows are left (NULL).
> - **Baseline:** monetization MO-2 `billing-plans-pricing` and FU-9 `billing-admin-requests`: `startPayment` hands the request over before `recordPaymentRequest` (`src/server/plans.ts`), a refresh mails again, a newline in the name adds lines to the owner's mail, one text says "fill in" for a too-long optional tax ID, an unclosed request keeps personal data forever, and a manual grant records no price. After: the gap is closed and covered by unit and e2e tests.

## Constraints

- Owns: `modules/billing/` requests, invoice fields, a migration for the price snapshot, the error messages (lane C, after FU-26).
- English only. No release, tag or publish (owner).

## Notes

- Filed by FU-12 (`billing-retro-reviews`, 2026-10-04).

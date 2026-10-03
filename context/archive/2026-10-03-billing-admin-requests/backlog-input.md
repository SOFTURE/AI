---
change_id: billing-admin-requests
title: "Payment requests, revoke and grant history in the billing admin page"
status: backlog
roadmap_item: FU-9
branch: null
created: 2026-10-03
updated: 2026-10-03
archived_at: null
---

## Intent

The billing admin page lists the open invoice requests (stored instead of only handed to
`onRequest`), grants a plan from a request in one click, revokes a mistaken grant, and shows the
history of grants per account; optionally a `grant-plan` script for hosts without the admin page.

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **FU-9** (roadmap `followups`, main since 2026-10-03):

> ### FU-9: Payment requests, revoke and grant history in the billing admin page
> - **Change ID:** `billing-admin-requests`
> - **Status:** proposed
> - **Outcome:** Invoice requests stored in a billing table and listed in `BillingAdminPage` with a one-click grant; a revoke action; a history of grants per account; optionally a `grant-plan` script; the payment page and the grant form tell a lifetime account apart (today it can still request an invoice, and a dated grant to it is a silent no-op).
> - **Prerequisites:** none beyond the main branch (MO-3 may add a payment-events table to share).
> - **Unknowns:** One table for manual requests and provider payment events vs. two; retention of invoice details (personal data, privacy contributor).
> - **Risk:** LOW.
> - **Baseline:** monetization MO-2 `billing-plans-pricing`: requests reach the owner only through `manual({ onRequest })` (the example mails them); the admin grants by email, cannot revoke and sees no history (README §12). After: the gap is closed and covered by unit and e2e tests.
> - **PRD refs:** FR-22.
> - **Source:** `modules/billing/README.md` §12

Reference material: [`docs/02-module-standard.md`](../../../docs/02-module-standard.md) (the standard).

## Constraints

- Exclusively owns: `modules/billing/` admin requests, revoke and history; a billing migration.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.

## Notes

---
change_id: billing-provider-adapter
title: "Payment provider adapter"
status: backlog
roadmap_item: MO-3
branch: null
created: 2026-10-02
updated: 2026-10-02
archived_at: null
---

## Intent

A provider adapter implementing `PaymentProvider`: checkout session creation, verified webhooks with idempotent processing, entitlement updates on payment and refund, and test-mode e2e against the provider's sandbox.

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **MO-3** (roadmap `monetization`, main since 2026-10-03):

> ### MO-3: Payment provider adapter
> - **Change ID:** `billing-provider-adapter`
> - **Status:** blocked (owner decision: Stripe vs Przelewy24)
> - **Outcome:** A provider adapter implementing `PaymentProvider`: checkout session creation, verified webhooks with idempotent processing, entitlement updates on payment and refund, and test-mode e2e against the provider's sandbox.
> - **Prerequisites:** MO-2; the owner's choice of provider and sandbox credentials.
> - **Unknowns:** Which provider; webhook signature verification and replay protection; whether a payment-events table is needed for idempotency.
> - **Risk:** high. Money and webhooks.
> - **Baseline:** Only the manual adapter exists. After: a sandbox payment turns a trial into paid without owner action.
> - **PRD refs:** FR-22, NFR-5.

Reference material: [`docs/02-module-standard.md`](../../../docs/02-module-standard.md) (the standard),
[`docs/01-module-assessment.md`](../../../docs/01-module-assessment.md) (source map in FIRE_TRACKER).

## Constraints

- Exclusively owns: `modules/billing/` provider adapter, `modules/billing/migrations/` (payment events, if needed).
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.

## Notes

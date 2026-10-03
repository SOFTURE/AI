---
change_id: billing-plans-pricing
title: "Plans, pricing tiles and the manual payment flow"
status: backlog
roadmap_item: MO-2
branch: null
created: 2026-10-02
updated: 2026-10-02
archived_at: null
---

## Intent

Plans declared in config (name, price, currency, period, features); `<PricingTiles/>` and a payment page; a `manual()` payment adapter (request an invoice, owner grants access through an admin action guarded by auth roles) that updates `billing.entitlements`; a `PaymentProvider` interface ready for real providers.

## Context

From [`roadmap.md`](../../../foundation/roadmap.md), item **MO-2** (roadmap `monetization`, main since 2026-10-03):

> ### MO-2: Plans, pricing tiles and the manual payment flow
> - **Change ID:** `billing-plans-pricing`
> - **Status:** ready
> - **Outcome:** Plans declared in config (name, price, currency, period, features); `<PricingTiles/>` and a payment page; a `manual()` payment adapter (request an invoice, owner grants access through an admin action guarded by auth roles) that updates `billing.entitlements`; a `PaymentProvider` interface ready for real providers.
> - **Prerequisites:** MO-1.
> - **Unknowns:** The admin surface for granting access (page vs. CLI command); multi-currency formatting through messages; whether plans need a DB table for price history.
> - **Risk:** low.
> - **Baseline:** FIRE has hard-coded prices and grants access with a script. After: the example app shows plans from config and an admin grant flips a trial to paid (e2e).
> - **PRD refs:** FR-22.

Reference material: [`docs/02-module-standard.md`](../../../../docs/02-module-standard.md) (the standard),
[`docs/01-module-assessment.md`](../../../../docs/01-module-assessment.md) (source map in FIRE_TRACKER).

## Constraints

- Exclusively owns: `modules/billing/` plans, pricing and payment UI, manual adapter, `examples/next-app/e2e/billing-pricing.spec.ts`.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.

## Notes

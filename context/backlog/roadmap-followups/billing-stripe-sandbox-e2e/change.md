---
change_id: billing-stripe-sandbox-e2e
title: "Stripe sandbox payment end to end"
status: backlog
roadmap_item: FU-10
branch: null
created: 2026-10-03
updated: 2026-10-03
archived_at: null
---

## Intent

A browser payment on Stripe's sandbox Checkout (test card) whose webhook reaches the app (Stripe CLI forwarding or a reachable preview) and turns the trial into paid, run in CI when the Stripe test secrets are set.

## Context

From [`roadmap-followups.md`](../../../foundation/roadmaps/roadmap-followups.md), item **FU-10** (queued roadmap `followups`):

> ### FU-10: Stripe sandbox payment end to end
> - **Change ID:** `billing-stripe-sandbox-e2e`
> - **Status:** proposed
> - **Outcome:** A browser payment on Stripe's sandbox Checkout (test card) whose webhook reaches the app (Stripe CLI forwarding or a reachable preview) and turns the trial into paid, run in CI when the Stripe test secrets are set.
> - **Prerequisites:** the owner's Stripe test-mode secrets (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) in the repository; the Stripe CLI or a public URL for the e2e server.
> - **Unknowns:** How the webhook reaches a CI run (`stripe listen` in the job vs. a deployed preview); how stable Stripe's hosted page is for Playwright.
> - **Risk:** MEDIUM.
> - **Baseline:** monetization MO-3 `billing-provider-adapter`: the Checkout API is tested against the sandbox (`modules/billing/tests/stripe-sandbox.test.ts`, only with the key) and the webhook with signed fixtures (`e2e/billing-stripe.spec.ts`); no test pays in the sandbox and receives Stripe's own delivery (README §12). After: the gap is closed and covered by an e2e test.
> - **PRD refs:** FR-22.
> - **Source:** `modules/billing/README.md` §12

Reference material: [`docs/02-module-standard.md`](../../../../docs/02-module-standard.md) (the standard).

## Constraints

- Exclusively owns: `examples/next-app/e2e/` Stripe sandbox spec, `.github/workflows/e2e.yml`.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.

## Notes

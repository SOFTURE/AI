---
change_id: billing-refund-one-payment
title: "Refunds that take back one payment's period"
status: backlog
roadmap_item: FU-11
branch: null
created: 2026-10-03
updated: 2026-10-03
archived_at: null
---

## Intent

A full refund removes only the access the refunded payment granted (its period, or the lifetime it bought), not every paid period of the account; optionally partial refunds handled by a policy.

## Context

From [`roadmap.md`](../../../foundation/roadmap.md), item **FU-11** (roadmap `followups`, main since 2026-10-03):

> ### FU-11: Refunds that take back one payment's period
> - **Change ID:** `billing-refund-one-payment`
> - **Status:** proposed
> - **Outcome:** A full refund removes only the access the refunded payment granted (its period, or the lifetime it bought), not every paid period of the account; optionally partial refunds handled by a policy.
> - **Prerequisites:** none beyond the main branch.
> - **Unknowns:** Storing each payment's granted start and end in `billing.payments`; a shortening entitlement event vs. recomputing access from the remaining payments; how manual grants (no payment row) count.
> - **Risk:** MEDIUM.
> - **Baseline:** monetization MO-3 `billing-provider-adapter`: `charge.refunded` revokes all paid access (`revoke`), so a refund of one of two stacked months, or of a monthly payment next to a lifetime, takes everything (README §12, plan review W4). After: the gap is closed and covered by unit and e2e tests.
> - **PRD refs:** FR-22.
> - **Source:** `modules/billing/README.md` §12; `context/archive/2026-10-03-billing-provider-adapter/reviews/plan-review.md` W4

Reference material: [`docs/02-module-standard.md`](../../../../docs/02-module-standard.md) (the standard).

## Constraints

- Exclusively owns: `modules/billing/` refunds, a billing migration.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.

## Notes

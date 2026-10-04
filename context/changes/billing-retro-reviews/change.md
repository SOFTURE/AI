---
change_id: billing-retro-reviews
title: "MO-1 and MO-2 carry their missing research and plan reviews, checked against today's code"
status: implementing
roadmap_item: FU-12
branch: claude/fu-12-retro-review-0g3oj6
created: 2026-10-04
updated: 2026-10-04
archived_at: null
---

## Intent

Whoever reads the monetization history finds a complete SOFTURE chain for MO-1 and MO-2: the
`billing-entitlements` archive gains `reviews/plan-review.md`, and the `billing-plans-pricing`
archive gains `research.md` and `reviews/plan-review.md`, each written after the fact and marked
as such. Every finding is checked against the billing code on `master` today (after MO-3…MO-5,
FU-11 and FU-9), and each one that still applies is filed as its own FU item in the followups
roadmap; nothing in `modules/billing/` changes here.

Input: [`backlog-input.md`](backlog-input.md) (roadmap item FU-12).

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **FU-12** (roadmap `followups`, main since 2026-10-03):

> - **Outcome:** `research.md` and `reviews/plan-review.md` written after the fact for `billing-entitlements` (MO-1, plan review skipped) and `billing-plans-pricing` (MO-2, research and plan review skipped); every finding that still applies to the code is fixed or filed as its own FU item.
> - **Unknowns:** Whether findings need code changes in `modules/billing/` (then they become their own items).
> - **Baseline:** monetization MO-1 and MO-2 skipped phases of the SOFTURE chain (coordinator, 2026-10-03, after the owner's question); their archives have no research.md or plan-review.md. After: both archives carry the missing documents.

State on `master` (b6c92c4): `context/archive/2026-10-03-billing-entitlements/` has `research.md`
and `reviews/impl-review.md` but no plan review; `context/archive/2026-10-03-billing-plans-pricing/`
has only `plan.md` and `reviews/impl-review.md`. The billing code has since moved on: MO-3 (Stripe,
`billing.payments`), FU-11 (one payment's refund, migration 0003) and FU-9 (requests, manual
grants, revoke, history, migration 0004).

## Constraints

- Exclusively owns: the two archive folders above (new documents only; existing documents stay
  untouched) and the new FU entries this change files.
- Must not touch `modules/billing/` or any code: lane C (FU-6, FU-20, FU-21, FU-22) owns billing
  code. A finding that needs code becomes a new FU item (owner decision 2026-10-03: gaps go to
  the followups roadmap, not fixed on the spot).
- English only. No release, tag or publish (owner).

## Notes

- Writing into `context/archive/` is normally off limits (softure-new anti-pattern); this item's
  roadmap outcome explicitly asks for documents in those two archives, so the exception is the
  item itself. Existing archived files are not edited.
- Research: done (`research.md` here), since the retro documents must rest on today's code.
- Framing skipped: the problem and the outcome are fixed by the roadmap item; there is no
  solution in doubt, only findings to collect.

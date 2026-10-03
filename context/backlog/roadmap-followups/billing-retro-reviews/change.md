---
change_id: billing-retro-reviews
title: "Retro research and plan review for MO-1 and MO-2"
status: backlog
roadmap_item: FU-12
branch: null
created: 2026-10-03
updated: 2026-10-03
archived_at: null
---

## Intent

`research.md` and `reviews/plan-review.md` written after the fact for `billing-entitlements` (MO-1, plan review skipped) and `billing-plans-pricing` (MO-2, research and plan review skipped); every finding that still applies to the code is fixed or filed as its own FU item.

## Context

From [`roadmap.md`](../../../foundation/roadmap.md), item **FU-12** (roadmap `followups`, main since 2026-10-03):

> ### FU-12: Retro research and plan review for MO-1 and MO-2
> - **Change ID:** `billing-retro-reviews`
> - **Status:** proposed
> - **Outcome:** `research.md` and `reviews/plan-review.md` written after the fact for `billing-entitlements` (MO-1, plan review skipped) and `billing-plans-pricing` (MO-2, research and plan review skipped); every finding that still applies to the code is fixed or filed as its own FU item.
> - **Prerequisites:** none beyond the main branch.
> - **Unknowns:** Whether findings need code changes in `modules/billing/` (then they become their own items).
> - **Risk:** LOW.
> - **Baseline:** monetization MO-1 and MO-2 skipped phases of the SOFTURE chain (coordinator, 2026-10-03, after the owner's question); their archives have no research.md or plan-review.md. After: both archives carry the missing documents.
> - **PRD refs:** FR-22.
> - **Source:** `context/archive/2026-10-03-billing-entitlements/`, `context/archive/2026-10-03-billing-plans-pricing/`

Reference material: [`docs/02-module-standard.md`](../../../../docs/02-module-standard.md) (the standard).

## Constraints

- Exclusively owns: the two archive folders above (documents only).
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.

## Notes

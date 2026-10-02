---
change_id: fire-adopt-monetization
title: "FIRE_TRACKER adopts billing and analytics"
status: backlog
roadmap_item: MO-7
branch: null
created: 2026-10-02
updated: 2026-10-02
archived_at: null
---

## Intent

Following `docs/05-adoption-playbook.md`, FIRE_TRACKER adopts billing and analytics: trial and paid columns move from its users table into `billing.entitlements`, its funnel table moves into `analytics.funnel_counts`, its own implementations and unit tests are deleted, its integration suite stays green, and gaps become issues in SOFTURE/AI.

## Context

From [`roadmap-monetization.md`](../../../foundation/roadmaps/roadmap-monetization.md), item **MO-7** (queued roadmap `monetization`):

> ### MO-7: FIRE_TRACKER adopts billing and analytics
> - **Change ID:** `fire-adopt-monetization`
> - **Status:** ready
> - **Outcome:** Following `docs/05-adoption-playbook.md`, FIRE_TRACKER adopts billing and analytics: trial and paid columns move from its users table into `billing.entitlements`, its funnel table moves into `analytics.funnel_counts`, its own implementations and unit tests are deleted, its integration suite stays green, and gaps become issues in SOFTURE/AI.
> - **Prerequisites:** MO-6.
> - **Unknowns:** Mapping FIRE's early-account rules and prices into plan config; keeping historical funnel rows across the move.
> - **Risk:** high. Production data and paid access are moved.
> - **Baseline:** FIRE runs its own copies. After: those copies are gone, FIRE CI is green, CHANGELOG entries say `verified in: FIRE_TRACKER@<sha>`.
> - **PRD refs:** FR-26, G-2.

Reference material: [`docs/02-module-standard.md`](../../../../docs/02-module-standard.md) (the standard),
[`docs/01-module-assessment.md`](../../../../docs/01-module-assessment.md) (source map in FIRE_TRACKER), [`docs/05-adoption-playbook.md`](../../../../docs/05-adoption-playbook.md) (adoption steps).

## Constraints

- Exclusively owns: nothing in this repository except the CHANGELOG verification lines; the work happens in FIRE_TRACKER.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.

## Notes

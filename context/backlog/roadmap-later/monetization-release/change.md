---
change_id: monetization-release
title: "Monetization modules release"
status: backlog
roadmap_item: MO-6
branch: null
created: 2026-10-02
updated: 2026-10-04
archived_at: null
---

## Intent

`@softure-ai/billing` and `@softure-ai/analytics` 0.1.0 published through the FD-2 pipeline (owner approves each first, staged publish and adds its trusted publisher); module READMEs and status lines updated; a finish review across MO-1…MO-5.

## Context

From [`roadmap-later.md`](../../../foundation/roadmaps/roadmap-later.md), item **MO-6** (carried over on 2026-10-03 from roadmap `monetization`,
archived in [`2026-10-03-3-roadmap.md`](../../../foundation/archive/2026-10-03-3-roadmap.md), to roadmap `marketing-kit`,
archived in [`2026-10-03-4-roadmap.md`](../../../foundation/archive/2026-10-03-4-roadmap.md), to roadmap `followups`,
archived in [`2026-10-04-roadmap.md`](../../../foundation/archive/2026-10-04-roadmap.md), and on to the queued roadmap `later`):

> ### MO-6: Monetization modules release
> - **Change ID:** `monetization-release`
> - **Status:** blocked (carried over from followups: the owner's batch release at the keyboard on 2026-10-05)
> - **Outcome:** `@softure-ai/billing` and `@softure-ai/analytics` 0.1.0 published through the FD-2 pipeline (owner approves each first, staged publish and adds its trusted publisher); module READMEs and status lines updated; a finish review across MO-1…MO-5.
> - **Prerequisites:** MO-1…MO-5 (done).
> - **Unknowns:** none beyond the owner's npm steps.
> - **Risk:** low.
> - **Baseline:** packages absent from npm. After: installable from npm and from GitHub Releases.
> - **PRD refs:** FR-2, G-4.

Reference material: [`docs/02-module-standard.md`](../../../../docs/02-module-standard.md) (the standard),
[`docs/01-module-assessment.md`](../../../../docs/01-module-assessment.md) (source map in FIRE_TRACKER).

## Constraints

- Exclusively owns: package versions and README status lines of billing and analytics.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.

## Notes

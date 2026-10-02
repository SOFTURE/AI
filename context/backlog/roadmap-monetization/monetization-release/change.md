---
change_id: monetization-release
title: "Monetization modules release"
status: backlog
roadmap_item: MO-6
branch: null
created: 2026-10-02
updated: 2026-10-02
archived_at: null
---

## Intent

`@softure-ai/billing` and `@softure-ai/analytics` 0.1.0 published through the FD-2 pipeline (owner approves each first, staged publish and adds its trusted publisher), including MO-3 if it is done in time; module READMEs and status lines updated; a finish review across the merged items.

## Context

From [`roadmap-monetization.md`](../../../foundation/roadmaps/roadmap-monetization.md), item **MO-6** (queued roadmap `monetization`):

> ### MO-6: Monetization modules release
> - **Change ID:** `monetization-release`
> - **Status:** ready
> - **Outcome:** `@softure-ai/billing` and `@softure-ai/analytics` 0.1.0 published through the FD-2 pipeline (owner approves each first, staged publish and adds its trusted publisher), including MO-3 if it is done in time; module READMEs and status lines updated; a finish review across the merged items.
> - **Prerequisites:** MO-2, MO-5 (MO-3 optional).
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

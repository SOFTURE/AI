---
change_id: deploy-workflow-release-guards
title: "The deploy workflow refuses a stray tag and carries build values"
status: backlog
roadmap_item: DF-11
branch: null
created: 2026-10-06
updated: 2026-10-06
archived_at: null
---

## Intent

`deploy-app.yml` refuses a tag whose commit is not on the default branch; takes build arguments (public origins baked into the image) and refuses a release whose built origin differs from the runtime secret (FIRE's L-117); takes non-secret values (an `app-vars` JSON) for optional compose names, so a switch like `1` is not masked in logs; sends a short-lived registry token with `.env.prod` instead of relying on a permanent registry login on the server.

## Context

From [`roadmap.md`](../../foundation/archive/2026-10-06-2-roadmap.md) (deploy-followups), item **DF-11**:

> - **Outcome:** `deploy-app.yml` refuses a tag whose commit is not on the default branch; takes build arguments (public origins baked into the image) and refuses a release whose built origin differs from the runtime secret (FIRE's L-117); takes non-secret values (an `app-vars` JSON) for optional compose names, so a switch like `1` is not masked in logs; sends a short-lived registry token with `.env.prod` instead of relying on a permanent registry login on the server.
> - **Source:** DF-1 (`deploy-fire-parity`), research: FIRE's `release.yml` (`prepare`, `image`, `deploy`) and `render-env-prod.mts` (research §1, §3).

## Constraints

- FIRE_TRACKER is read only; its code may be copied.
- Prerequisite: DF-7.

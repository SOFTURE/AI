---
change_id: deploy-workflow-verify-config
title: "The deploy workflow verifies with softure-deploy verify"
status: backlog
roadmap_item: DF-2
branch: null
created: 2026-10-05
updated: 2026-10-05
archived_at: null
---

## Intent

The `verify` job of `deploy-app.yml` runs `softure-deploy verify` with the app's `deploy.json` instead of only the health route.

## Context

From [`roadmap.md`](../../foundation/roadmap.md) (deploy-followups), item **DF-2** (main roadmap since 2026-10-06):

> - **Change ID:** `deploy-workflow-verify-config`
> - **Status:** ready
> - **Outcome:** The `verify` job runs `softure-deploy verify <app-url>` (DP-4) from the CLI version the workflow pins, reading the
>   app's `deploy.json` from the release tag; the health-route wait stays as the first step, so verify starts once the
>   new release answers.
> - **Prerequisites:** DP-4 on `master`.
> - **Unknowns:** whether `deploy.json` is required or optional (fall back to the health route).
> - **Risk:** low. Today the workflow checks only `/api/health`.
> - **Source:** DP-2 (`deploy-reusable-workflows`), implementation review.
> - **PRD refs:** FR-33.

## Constraints

- Owns `.github/workflows/deploy-*.yml` and `tools/deploy/examples/` while it runs.
- English-only code, comments and commits. FIRE_TRACKER is read only. No real deploy, tag or publish.

## Notes

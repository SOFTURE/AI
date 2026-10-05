---
change_id: deploy-workflow-fire-parity
title: "Parity of the deploy workflow with FIRE_TRACKER's release"
status: backlog
roadmap_item: DF-2
branch: null
created: 2026-10-05
updated: 2026-10-05
archived_at: null
---

## Intent

`deploy-app.yml` checked against FIRE_TRACKER's `release.yml` and `auto-release.yml` and its SSH gateway; generic steps ported, the rest recorded.

## Context

From [`roadmap-deploy-followups.md`](../../../foundation/roadmaps/roadmap-deploy-followups.md), item **DF-2**:

> - **Change ID:** `deploy-workflow-fire-parity`
> - **Status:** ready
> - **Outcome:** FIRE_TRACKER's `.github/workflows/release.yml`, `.github/workflows/auto-release.yml` and `docker/prod/` gateway
>   (`gateway.sh`, the forced command) are read; generic steps `deploy-app.yml` lacks (a release report post, image
>   pruning, rollback, tagging on merge) are ported or recorded as FIRE-specific, and the forced-command protocol
>   (`<remote-command> <tag>` with `.env.prod` on stdin) is aligned with the gateway DP-5 and `softure.vps_foundation` use.
> - **Prerequisites:** a session that can read FIRE_TRACKER.
> - **Unknowns:** whether FIRE's gateway receives the env file on stdin or over a separate command.
> - **Risk:** medium. The workflow talks to a server it was never run against; a protocol mismatch fails the first deploy (safely, before the switch).
> - **Source:** DP-2 (`deploy-reusable-workflows`), implementation review.
> - **PRD refs:** FR-33.

## Constraints

- Owns `.github/workflows/deploy-*.yml` and `tools/deploy/examples/` while it runs.
- English-only code, comments and commits. FIRE_TRACKER is read only. No real deploy, tag or publish.

## Notes

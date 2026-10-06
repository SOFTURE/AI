---
change_id: deploy-verify-origin-firewall
title: "verify checks that the origin refuses direct traffic"
status: backlog
roadmap_item: DF-13
branch: null
created: 2026-10-06
updated: 2026-10-06
archived_at: null
---

## Intent

`deploy.json` gets an optional origin address (or `verify` a flag) and `softure-deploy verify` adds a row that passes only when direct HTTPS to that address gets no answer, so a firewall that let more than the CDN through fails the release.

## Context

From [`roadmap.md`](../../../foundation/roadmap.md) (deploy-followups), item **DF-13**:

> - **Outcome:** `deploy.json` gets an optional origin address (or `verify` a flag) and `softure-deploy verify` adds a row that passes only when direct HTTPS to that address gets no answer, so a firewall that let more than the CDN through fails the release.
> - **Source:** DF-1 (`deploy-fire-parity`), research: FIRE's `verify-production.sh`, the `DEPLOY_IP` check (research §5).

## Constraints

- FIRE_TRACKER is read only; its code may be copied.
- Prerequisite: none.

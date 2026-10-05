---
change_id: deploy-verify-fire-parity
title: "softure-deploy verify covers every generic check of FIRE_TRACKER's verify-production.sh"
status: backlog
roadmap_item: DF-2
branch: null
created: 2026-10-05
updated: 2026-10-05
archived_at: null
---

## Intent

`softure-deploy verify` checks everything FIRE_TRACKER's `scripts/verify-production.sh` checks that is not specific
to FIRE; what stays FIRE-specific is listed in the package README, and FIRE's route list is written down as the
`deploy.json` FIRE will adopt (in FIRE's own roadmap, not here).

## Context

From [`roadmap-deploy-followups.md`](../../../foundation/roadmaps/roadmap-deploy-followups.md), item **DF-2**:

> - **Outcome:** FIRE_TRACKER's `scripts/verify-production.sh` (548 lines) is read; every generic check it makes
>   beyond status, markers, redirects and headers is added to `deploy.json` and the engine, and the rest is listed
>   as FIRE-specific in the package README.
> - **Source:** DP-4 (`deploy-verify-production`), research: the session could not read FIRE_TRACKER (cloning it was
>   refused in the cloud session), so the generic checks came from the roadmap and HTTP semantics.

## Constraints

- Owns `tools/deploy/src/verify/`, `tools/deploy/schema/` and their tests.
- FIRE_TRACKER is read only.

## Notes

- Source: DP-4 research (`deploy-verify-production`), question 1 and the roadmap baseline "the engine in TS".

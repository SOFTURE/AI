---
change_id: deploy-db-guard-fire-parity
title: "The database steps of the deploy CLI match FIRE_TRACKER's deploy.sh where it is generic"
status: backlog
roadmap_item: DF-2
branch: null
created: 2026-10-05
updated: 2026-10-05
archived_at: null
---

## Intent

`softure-deploy backup`, `schema-guard` and `row-counts` cover every generic check of FIRE_TRACKER's
`docker/server/deploy.sh` (backup format and retention default, the schema guard's cases, which counts it compares
and what it does on a drop); what stays FIRE-specific is listed in the package README.

## Context

From [`roadmap-deploy-followups.md`](../../../foundation/roadmaps/roadmap-deploy-followups.md), item **DF-2**:

> - **Outcome:** FIRE_TRACKER's `docker/server/deploy.sh` is read; each generic database step it runs (backup,
>   schema guard on the drizzle table, row counts) is compared with DP-3's commands, gaps are ported into
>   `tools/deploy/src/db/` with tests, and the rest is listed as FIRE-specific in the package README.
> - **Source:** DP-3 (`deploy-db-guard`), research: the session could not read FIRE_TRACKER, so the commands follow
>   the roadmap item, not FIRE's script.

## Constraints

- Owns `tools/deploy/src/db/` and its tests.
- FIRE_TRACKER is read only.

## Notes

- Source: DP-3 research (`deploy-db-guard`), the DP-3 baseline "the same checks in TS against the softure ledger".

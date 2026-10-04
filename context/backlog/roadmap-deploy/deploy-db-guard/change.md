---
change_id: deploy-db-guard
title: "Backup and schema guard before a deploy"
status: backlog
roadmap_item: DP-3
branch: null
created: 2026-10-04
updated: 2026-10-04
archived_at: null
---

## Intent

Backup before a deploy, a schema guard on the `@softure-ai/db` ledger and row counts before and after from an app hook.

## Context

From [`roadmap-deploy.md`](../../../foundation/roadmaps/roadmap-deploy.md), item **DP-3** (queued roadmap `deploy`):

> ### DP-3: Backup and schema guard before a deploy
> - **Change ID:** `deploy-db-guard`
> - **Status:** ready
> - **Outcome:**
>   - `softure-deploy backup`: a `pg_dump` before the deploy with retention;
>   - `softure-deploy schema-guard`: reads the `@softure-ai/db` migration ledger and refuses a deploy whose image expects migrations the database cannot take (checksum or order);
>   - row counts before and after the deploy for a table list from the app's config (FIRE's `users/snapshots/position_values` becomes config).
> - **Prerequisites:** DP-1.
> - **Unknowns:** Whether the guard runs inside the new image (it has the migrations) or on the host before the switch.
> - **Risk:** medium. Production data safety.
> - **Baseline:** FIRE `docker/server/deploy.sh` (backup, schema guard on the drizzle table, counts). After: the same checks in TS against the softure ledger, tested on Postgres.
> - **PRD refs:** FR-33, NFR-4.
> - **Source (FIRE_TRACKER, read only):** `docker/server/deploy.sh`

Reference material: [`docs/06-fire-extraction-2.md`](../../../../docs/06-fire-extraction-2.md) (the FIRE_TRACKER source map and the split rules),
[`docs/02-module-standard.md`](../../../../docs/02-module-standard.md) (the standard). FIRE_TRACKER is read only:
copy its code, never change it.

## Constraints

- Exclusively owns: `tools/deploy/src/db/`.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.

## Notes

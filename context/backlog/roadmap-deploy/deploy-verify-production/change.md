---
change_id: deploy-verify-production
title: "Production verify from config"
status: backlog
roadmap_item: DP-4
branch: null
created: 2026-10-04
updated: 2026-10-04
archived_at: null
---

## Intent

`softure-deploy verify`: routes, expected statuses, markers, redirects and headers from `deploy.json`.

## Context

From [`roadmap-deploy.md`](../../../foundation/roadmaps/roadmap-deploy.md), item **DP-4** (queued roadmap `deploy`):

> ### DP-4: Production verify from config
> - **Change ID:** `deploy-verify-production`
> - **Status:** ready
> - **Outcome:**
>   - `deploy.json` (zod schema, published as JSON Schema): routes with expected status, body markers, redirects and headers;
>   - `softure-deploy verify <url>`: runs every check, prints a table, exits non-zero on a failure;
>   - FIRE's route lists stay in FIRE's `deploy.json`.
> - **Prerequisites:** DP-1.
> - **Unknowns:** Which checks of FIRE's 548-line script are generic beyond routes (TLS, headers, robots).
> - **Risk:** low.
> - **Baseline:** FIRE `scripts/verify-production.sh` (548 lines, 100+ of FIRE routes). After: the engine in TS with tests against a local server.
> - **PRD refs:** FR-33.
> - **Source (FIRE_TRACKER, read only):** `scripts/verify-production.sh`

Reference material: [`docs/06-fire-extraction-2.md`](../../../../docs/06-fire-extraction-2.md) (the FIRE_TRACKER source map and the split rules),
[`docs/02-module-standard.md`](../../../../docs/02-module-standard.md) (the standard). FIRE_TRACKER is read only:
copy its code, never change it.

## Constraints

- Exclusively owns: `tools/deploy/src/verify/`, `tools/deploy/schema/`.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.

## Notes

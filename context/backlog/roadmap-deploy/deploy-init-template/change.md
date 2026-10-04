---
change_id: deploy-init-template
title: "Deploy files generated once"
status: backlog
roadmap_item: DP-5
branch: null
created: 2026-10-04
updated: 2026-10-04
archived_at: null
---

## Intent

`softure-deploy init` writes compose, Traefik rules, Dockerfile, the server script and the caller workflow once.

## Context

From [`roadmap-deploy.md`](../../../foundation/roadmaps/roadmap-deploy.md), item **DP-5** (queued roadmap `deploy`):

> ### DP-5: Deploy files generated once
> - **Change ID:** `deploy-init-template`
> - **Status:** ready
> - **Outcome:** `softure-deploy init` generates files the app then owns (never overwrites without `--force`):
>   - production `docker-compose.yml` and Traefik rules (apex router with the app's allowed paths);
>   - a `Dockerfile` for a Next standalone build;
>   - the server `deploy.sh` that calls DP-3 and the caller workflow for DP-2;
>   - a `deploy.json` starter for DP-4.
>
>   A test generates into a temp folder and builds the example app's image in CI.
> - **Prerequisites:** DP-2, DP-3, DP-4.
> - **Unknowns:** Which answers `init` asks (domain, services, migrations step) and which it reads from `softure.config`.
> - **Risk:** medium.
> - **Baseline:** FIRE `docker/**`, `docker/prod/docker-compose.yml`, `docker/prod/traefik.yml`, `docker/server/deploy.sh`. After: generated files for the example app that build.
> - **PRD refs:** FR-34.
> - **Source (FIRE_TRACKER, read only):** `docker/Dockerfile`, `docker/prod/docker-compose.yml`, `docker/prod/traefik.yml`, `docker/server/deploy.sh`

Reference material: [`docs/06-fire-extraction-2.md`](../../../../docs/06-fire-extraction-2.md) (the FIRE_TRACKER source map and the split rules),
[`docs/02-module-standard.md`](../../../../docs/02-module-standard.md) (the standard). FIRE_TRACKER is read only:
copy its code, never change it.

## Constraints

- Exclusively owns: `tools/deploy/templates/`, `tools/deploy/src/init/`.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.

## Notes

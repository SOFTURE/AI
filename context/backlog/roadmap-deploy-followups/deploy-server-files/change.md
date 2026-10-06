---
change_id: deploy-server-files
title: "The deploy workflow ships the server files with each release"
status: backlog
roadmap_item: DF-7
branch: null
created: 2026-10-06
updated: 2026-10-06
archived_at: null
---

## Intent

A changed production compose file, Traefik rule or `deploy.sh` reaches the server with the release that needs it,
instead of being copied there by hand before the release.

## Context

From [`roadmap.md`](../../../foundation/roadmap.md) (deploy-followups), item **DF-7** (main roadmap since 2026-10-06):

> - **Outcome:** `deploy-app.yml` sends the tag's `docker/prod/` files (and `docker/server/deploy.sh`) to the server
>   with `.env.prod`, for example as one archive on stdin that the forced command unpacks into a release folder before
>   it switches; `init`'s `deploy.sh` reads it; the forced-command protocol stays one SSH call.
> - **Source:** DP-5 (`deploy-init-template`), plan review S3: the workflow sends only `.env.prod`, so the files `init`
>   generates are copied to `/srv/<name>/` once and again whenever they change.

## Constraints

- Touches `.github/workflows/deploy-app.yml` (DP-2) and `tools/deploy/templates/docker/server/deploy.sh.tmpl` (DP-5).
- A script that updates itself mid-run must finish the old copy first: the new `deploy.sh` runs from the next release.

## Notes

- Source: DP-5 plan review S3 (`deploy-init-template`).

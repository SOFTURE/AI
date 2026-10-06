---
change_id: deploy-server-safety
title: "The server deploy script matches FIRE's safety steps"
status: backlog
roadmap_item: DF-9
branch: null
created: 2026-10-06
updated: 2026-10-06
archived_at: null
---

## Intent

`init`'s `deploy.sh` gains FIRE's server-side safety steps: a read-only `status` command (tag, containers, health); the current compose files and `.env.prod` saved before the switch and restored when it fails, `.env.prod.prev` kept; Traefik recreated when `traefik.yml` changed; the tag written into `.env.prod`, so a manual or cron `docker compose` works; a daily cron for `backup --max-age-days` and `docker image prune`; one machine-readable line per step and a final result line the workflow checks.

## Context

From [`roadmap.md`](../../../foundation/roadmap.md) (deploy-followups), item **DF-9**:

> - **Outcome:** `init`'s `deploy.sh` gains FIRE's server-side safety steps: a read-only `status` command (tag, containers, health); the current compose files and `.env.prod` saved before the switch and restored when it fails, `.env.prod.prev` kept; Traefik recreated when `traefik.yml` changed; the tag written into `.env.prod`, so a manual or cron `docker compose` works; a daily cron for `backup --max-age-days` and `docker image prune`; one machine-readable line per step and a final result line the workflow checks.
> - **Source:** DF-1 (`deploy-fire-parity`), research: FIRE's `docker/server/gateway.sh` and `deploy.sh` (research §4).

## Constraints

- FIRE_TRACKER is read only; its code may be copied.
- Prerequisite: DF-7.

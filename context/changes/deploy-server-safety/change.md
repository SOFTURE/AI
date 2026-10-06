---
change_id: deploy-server-safety
title: "The server deploy script matches FIRE's safety steps"
status: planned
roadmap_item: DF-9
branch: claude/project-thread-etlm0d
created: 2026-10-06
updated: 2026-10-06
archived_at: null
---

## Intent

`init`'s server `deploy.sh` gains FIRE_TRACKER's server-side safety steps, so a failed release leaves the server as
it was, a cut SSH session cannot read as a success, and a server between releases keeps its backups and images in
bounds without anyone at the keyboard.

## Context

From [`roadmap.md`](../../foundation/roadmap.md) (deploy-followups), item **DF-9**:

> - **Outcome:** `init`'s `deploy.sh` gains FIRE's server-side safety steps: a read-only `status` command (tag,
>   containers, health); the current compose files and `.env.prod` saved before the switch and restored when it
>   fails, `.env.prod.prev` kept; Traefik recreated when `traefik.yml` changed; the tag written into `.env.prod`, so
>   a manual or cron `docker compose` works; a daily cron for `backup --max-age-days` and `docker image prune`; one
>   machine-readable line per step and a final result line the workflow checks.
> - **Source:** DF-1 (`deploy-fire-parity`), research: FIRE's `docker/server/gateway.sh` and `deploy.sh` (research §4).

The taken backlog entry is kept as [`backlog-input.md`](backlog-input.md). DF-7
([archive](../../archive/2026-10-06-deploy-server-files/change.md)) made the release ship `deploy.sh` and the
`docker/prod/` files; DF-8 ([archive](../../archive/2026-10-06-deploy-row-count-server-list/change.md)) made it
count the tables of the shipped `deploy.json`.

## Constraints

- Touches `tools/deploy/templates/docker/server/deploy.sh.tmpl`, its tests, the README and one step of
  `.github/workflows/deploy-app.yml` (the result line check and the reserved names). DF-3 (workflow e2e) changes the
  same workflow in parallel: master is merged often, and this change keeps its workflow edit to those two places.
- No real deploy, tag or publish. Rides `@softure-ai/deploy` 0.1.3 (unpublished; carries DF-7 and DF-8).
- English-only code, comments and commits. FIRE_TRACKER is read only; its scripts are the reference.

## Notes

- Placement: main roadmap deploy-followups, item DF-9 (taken from `context/backlog/roadmap-deploy-followups/`).
- Research: done, short ([`research.md`](research.md)): what FIRE's two server scripts do step by step, what the
  current template already does (DF-7 restarts Traefik on changed rules, `--wait` health), and the two unknowns of
  the roadmap item (cron lines, where the result line is checked).
- Framing skipped: the item is a list of concrete steps already chosen against a working reference (FIRE's scripts,
  compared line by line in DF-1 §4); there is no competing explanation of the problem to weigh, only how each step
  fits the generated script.

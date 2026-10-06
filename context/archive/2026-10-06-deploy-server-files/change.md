---
change_id: deploy-server-files
title: "The deploy workflow ships the server files with each release"
status: archived
roadmap_item: DF-7
branch: claude/project-thread-d8xrl9
created: 2026-10-06
updated: 2026-10-06
archived_at: 2026-10-06
---

## Intent

Each run of `deploy-app.yml` sends the server, in the one SSH call it already makes, the files of the release tag the
server needs: the folder of the production compose file (`docker/prod/`: compose file, Traefik rules, `initdb/`), the
server script (`docker/server/deploy.sh`) and the app's `deploy.json`, together with the rendered `.env.prod`, as one
archive on stdin. `init`'s `deploy.sh` unpacks it into a release folder, checks it, installs the files next to itself
and only then pulls and switches. A changed compose file, Traefik rule or `deploy.sh` reaches the server with the
release that needs it; nobody copies files by hand after the first setup. A reviewer checks it with a test that runs the
workflow's pack step and the generated `deploy.sh` together against a stubbed Docker.

## Context

From [`roadmap.md`](../../foundation/roadmap.md) (deploy-followups), item **DF-7**:

> - **Outcome:** `deploy-app.yml` sends the tag's `docker/prod/` files (and `docker/server/deploy.sh`) to the server
>   with `.env.prod`, for example as one archive on stdin that the forced command unpacks into a release folder before
>   it switches; `init`'s `deploy.sh` reads it; the forced-command protocol stays one SSH call.
> - **Unknowns:** whether FIRE's gateway already ships files (DF-1 reads it).
> - **Risk:** medium. A missed copy runs a release against an older compose file; nothing fails loudly.
> - **Source:** DP-5 (`deploy-init-template`), plan review S3.

The taken backlog entry is kept as [`backlog-input.md`](backlog-input.md). The workflow came from DP-2 and DF-2
([archive](../../archive/2026-10-06-deploy-workflow-verify-config/change.md)), the server script from DP-5
([archive](../../archive/2026-10-06-deploy-init-template/change.md)). DF-5 (PR #122, open) records gap DF-8: the
server's `deploy.sh` will read the row-count tables from the shipped `deploy.json`. This change ships that file; DF-8
makes `deploy.sh` use it.

## Constraints

- Exclusively owns `.github/workflows/deploy-app.yml`, `tools/deploy/examples/`,
  `tools/deploy/templates/docker/server/deploy.sh.tmpl` and `tests/repo/deploy-workflows.test.ts` while it runs;
  DF-3 and DF-8 take them after this merges.
- Does not change `row-counts` or `deploy.json`'s schema (DF-5, DF-8) or `verify` (DF-6).
- A script that updates itself mid-run must finish the old copy first: the new `deploy.sh` runs from the next release.
- No real deploy, tag or publish. English-only code, comments and commits. FIRE_TRACKER is read only.

## Notes

- Placement: main roadmap deploy-followups, item DF-7 (taken from `context/backlog/roadmap-deploy-followups/`).
- Research: done (`research.md`): the server layout, how bash and Docker treat replaced files, what tar refuses.
- Framing skipped: the problem and the shape of the fix (one archive on stdin, one SSH call) are fixed by the roadmap
  item and DP-5's plan review; nothing about whether to build it is in doubt.
- FIRE's gateway: DF-1 has not landed (no session can read FIRE_TRACKER), so whether it ships files stays open and is
  recorded for DF-1 in the research.
- Archived 2026-10-06: `deploy-app.yml` packs the compose file's folder, `server-script` and `deploy-config` with
  `.env.prod` into one archive on stdin; `init`'s `deploy.sh` checks it, unpacks it into `releases/<tag>/`, installs
  the files next to itself (itself by a rename) and restarts Traefik when its rules changed. `@softure-ai/deploy`
  0.1.2; waiting for its release and the owner's `deploy-workflows-v1` tag. No new gap; DF-8 (from DF-5) makes
  `deploy.sh` read the shipped `deploy.json`.

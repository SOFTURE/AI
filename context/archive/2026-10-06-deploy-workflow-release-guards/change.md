---
change_id: deploy-workflow-release-guards
title: "The deploy workflow refuses a stray tag and carries build values"
status: archived
roadmap_item: DF-11
branch: claude/project-thread-8ztufp
created: 2026-10-06
updated: 2026-10-06
archived_at: 2026-10-06
---

## Intent

`deploy-app.yml` deploys only a tag whose commit is on the release branch (the repository's default branch unless the
caller names another); takes build arguments for values baked into the image and refuses a release whose rendered
`.env.prod` holds a different value under the same name (FIRE's L-117: the origin in the image and the runtime secret
drifted apart and every write failed); takes non-secret values (`app-vars`, e.g. `toJSON(vars)`) that win over
secrets of the same name, so a switch like `1` reaches `.env.prod` without masking every `1` in the logs; and sends
the deploy job's short-lived `GITHUB_TOKEN` in the release archive, which `init`'s `deploy.sh` uses to pull the image
through a throwaway Docker config, so the server needs no permanent registry login.

## Context

From [`roadmap.md`](../../foundation/roadmap.md) (deploy-followups), item **DF-11**:

> - **Outcome:** `deploy-app.yml` refuses a tag whose commit is not on the default branch; takes build arguments
>   (public origins baked into the image) and refuses a release whose built origin differs from the runtime secret
>   (FIRE's L-117); takes non-secret values (an `app-vars` JSON) for optional compose names, so a switch like `1` is
>   not masked in logs; sends a short-lived registry token with `.env.prod` instead of relying on a permanent
>   registry login on the server.
> - **Unknowns:** the input names; whether the token rides in DF-7's stdin archive or a second file.
> - **Source:** DF-1 (`deploy-fire-parity`), research: FIRE's `release.yml` (`prepare`, `image`, `deploy`) and
>   `render-env-prod.mts` (research §1, §3).

The taken backlog entry is kept as [`backlog-input.md`](backlog-input.md). The workflow and the archive protocol come
from DF-7 ([archive](../../archive/2026-10-06-deploy-server-files/change.md)), its end-to-end test from DF-3
([archive](../../archive/2026-10-06-deploy-workflow-e2e/change.md)).

## Constraints

- Mostly `.github/workflows/deploy-app.yml`; `init`'s `deploy.sh.tmpl` changes only around the pull (DF-9 runs in
  parallel on the same template; the second to merge takes `master`).
- Runs before any value reaches the server; nothing new is printed but names.
- No real deploy, tag or publish. English-only code, comments and commits. FIRE_TRACKER is read only.

## Notes

- Placement: main roadmap deploy-followups, item DF-11 (taken from `context/backlog/roadmap-deploy-followups/`).
- Research: done (`research.md`), short: DF-1's research already compared FIRE's `release.yml` and
  `render-env-prod.mts` with the workflow; this one reads the details the plan needs.
- Framing skipped: the roadmap item fixes the problem and the four pieces, each a port of a FIRE behaviour DF-1
  found missing; nothing about whether to build it is in doubt.
- Archived 2026-10-06: `deploy-app.yml` refuses a tag off the release branch (`release-branch`, else the default
  branch), bakes `build-args` and stops when one differs from `.env.prod` under the same name, renders `app-vars`
  over `app-secrets`, and sends the deploy job's `GITHUB_TOKEN` as `.registry-token`, which `init`'s `deploy.sh`
  uses through a throwaway `DOCKER_CONFIG`. Rides `@softure-ai/deploy` 0.1.3; waiting for its release. No new gap.

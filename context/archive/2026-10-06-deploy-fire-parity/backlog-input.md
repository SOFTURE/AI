---
change_id: deploy-fire-parity
title: "The deploy CLI matches FIRE_TRACKER's env and release-notes behaviour where it is generic"
status: backlog
roadmap_item: DF-1
branch: null
created: 2026-10-05
updated: 2026-10-05
archived_at: null
---

## Intent

`softure-deploy env render`, `release-notes`, `backup`, `schema-guard`, `row-counts` and `verify` behave like FIRE_TRACKER's
scripts (`docker/server/deploy.sh` for the database steps) wherever that behaviour is generic, with FIRE's test cases ported into `tools/deploy`; what stays FIRE-specific is listed in the
package README.

## Context

From [`roadmap.md`](../../foundation/archive/2026-10-06-2-roadmap.md) (deploy-followups), item **DF-1** (main roadmap since 2026-10-06):

> - **Outcome:** FIRE_TRACKER's `scripts/render-env-prod.mts`, `scripts/release-notes.mts`, `src/lib/release-notes.ts`,
>   their tests and `.github/workflows/release-opis.yml` are read; every behaviour and test case that is generic is
>   ported into `tools/deploy` (report format, env edge cases), and the rest is listed as FIRE-specific in the
>   package README. The same for the deploy workflow (DP-2): FIRE's `.github/workflows/release.yml`,
>   `auto-release.yml` and its SSH gateway (`docker/prod/`, the forced command) are read; generic steps
>   `deploy-app.yml` lacks are ported or recorded, and the forced-command protocol (`<remote-command> <tag>` with
>   `.env.prod` on stdin) is aligned with FIRE's gateway.
> - **Source:** DP-1 (`deploy-cli-env-notes`), research: the session could not read FIRE_TRACKER (cloning it was
>   refused by the sandbox), so the report format comes from the roadmap, not from FIRE's workflow.

## Constraints

- Owns `tools/deploy/src/env/`, `tools/deploy/src/notes/`, `tools/deploy/src/db/`, `tools/deploy/src/verify/` and their tests.
- FIRE_TRACKER is read only.

## Notes

- Source: DP-1 research (`deploy-cli-env-notes`), the DP-1 baseline "the same tests green in the package".
- DP-3 (`deploy-db-guard`) added the database steps: its research could not read `docker/server/deploy.sh` either.
- Extended by DP-4 (`deploy-verify-production`): FIRE's `scripts/verify-production.sh` could not be read either; its
  generic checks beyond status, markers, redirects and headers are part of this parity check.

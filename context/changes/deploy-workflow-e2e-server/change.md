---
change_id: deploy-workflow-e2e-server
title: "The deploy workflow's end-to-end test runs the server side and verify"
status: planned
roadmap_item: DF-15
branch: claude/project-thread-bhk1zk
created: 2026-10-06
updated: 2026-10-06
archived_at: null
---

## Intent

The end-to-end test of `deploy-app.yml` (DF-3) goes past the forced command: the throwaway server runs the shipped
`deploy.sh` with the release (the image handed over without a registry push, the stack started on the runner), and
`softure-deploy verify` checks the app it serves, so a broken `deploy.sh` or `verify` step fails in CI too.

## Context

From [`roadmap.md`](../../foundation/roadmap.md) (deploy-followups), item **DF-15**:

> - **Outcome:** on the `e2e` path the server's forced command runs the shipped `deploy.sh` (image loaded from the
>   build job's artifact, the stack up on the runner), and `verify` runs `softure-deploy verify` against it.
> - **Unknowns:** how `verify` (https only) reaches the runner's app: a local certificate or an `http://` allowance on
>   the test path only.
> - **Source:** DF-3 (`deploy-workflow-e2e`), implementation: the recorder stops at the forced command; `verify`
>   needs the app over HTTPS on a public name, so it is skipped on the test path.

The taken backlog entry is kept as [`backlog-input.md`](backlog-input.md). The test path came from DF-3
([archive](../../archive/2026-10-06-deploy-workflow-e2e/change.md)); the `deploy.sh` it now runs is DF-9's
([archive](../../archive/2026-10-06-deploy-server-safety/change.md)).

## Constraints

- Touches `.github/workflows/deploy-app.yml`, `.github/workflows/e2e-deploy.yml`, `tools/deploy/e2e/`, the e2e app
  generator and their tests. Production callers' path must not change.
- The build and deploy jobs run on different runners: the image reaches the server as an artifact, not a push.
- `verify` takes `https://` URLs; the test must not loosen that for production callers.
- No real deploy, tag, publish or registry push. English-only code, comments and commits. FIRE_TRACKER is read only.

## Notes

- Placement: main roadmap deploy-followups, item DF-15 (taken from `context/backlog/roadmap-deploy-followups/`).
- Research: done (`research.md`), with the server side run locally in Docker before planning.
- Framing skipped: the roadmap item fixes the problem (the e2e stops at the forced command) and the shape (run the
  shipped `deploy.sh` and `verify` on the test path); research answered its one unknown (TLS) without changing what
  to build.

---
change_id: deploy-workflow-e2e-server
title: "The deploy workflow's end-to-end test runs the server side and verify"
status: backlog
roadmap_item: DF-15
branch: null
created: 2026-10-06
updated: 2026-10-06
archived_at: null
---

## Intent

The end-to-end test of `deploy-app.yml` (DF-3) goes past the forced command: the throwaway server runs the shipped
`deploy.sh` with the release (the image handed over without a registry, the stack started on the runner), and the
`verify` job checks the app it serves, so a broken `deploy.sh` or `verify` step fails in CI too.

## Context

From [`roadmap.md`](../../../foundation/roadmap.md) (deploy-followups), item **DF-15**:

> - **Outcome:** on the `e2e` path the server's forced command runs the shipped `deploy.sh` (image loaded from the
>   build job's artifact, the stack up on the runner), and `verify` runs `softure-deploy verify` against it.
> - **Source:** DF-3 (`deploy-workflow-e2e`), implementation: the recorder stops at the forced command; `verify`
>   needs the app over HTTPS on a public name, so it is skipped on the test path.

## Constraints

- Touches `.github/workflows/deploy-app.yml`, `.github/workflows/e2e-deploy.yml` and `tools/deploy/e2e/`.
- The build and deploy jobs run on different runners: the image reaches the server as an artifact, not a push.
- `verify` takes `https://` URLs only; a local certificate (or an input that allows `http://` on the test path only)
  is part of the work.

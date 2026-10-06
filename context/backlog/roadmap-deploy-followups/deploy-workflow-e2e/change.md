---
change_id: deploy-workflow-e2e
title: "The deploy workflow runs end to end in CI"
status: backlog
roadmap_item: DF-3
branch: null
created: 2026-10-05
updated: 2026-10-05
archived_at: null
---

## Intent

A CI job runs `deploy-app.yml` against a throwaway SSH server and registry, so a broken step fails here, not on the first live deploy.

## Context

From [`roadmap.md`](../../../foundation/roadmap.md) (deploy-followups), item **DF-3** (main roadmap since 2026-10-06):

> - **Change ID:** `deploy-workflow-e2e`
> - **Status:** ready
> - **Outcome:** A workflow in this repository calls `./.github/workflows/deploy-app.yml` for the example app against a local
>   `sshd` container with a forced command that records what it received and a local registry (or `push: false`
>   through an input), asserting the image, the command line and the rendered `.env.prod` names.
> - **Prerequisites:** DP-5 (the example app's production compose and Dockerfile) and `@softure-ai/deploy` on npm (DP-8), or an input to run the CLI from the checkout.
> - **Unknowns:** whether GHCR can be swapped for a local registry without an input that production callers could misuse.
> - **Risk:** medium. DP-2 is validated statically only (actionlint, the repository test, the scripts run by hand).
> - **Source:** DP-2 (`deploy-reusable-workflows`), implementation review.
> - **PRD refs:** FR-33.

## Constraints

- Owns `.github/workflows/deploy-*.yml` and `tools/deploy/examples/` while it runs.
- English-only code, comments and commits. FIRE_TRACKER is read only. No real deploy, tag or publish.

## Notes

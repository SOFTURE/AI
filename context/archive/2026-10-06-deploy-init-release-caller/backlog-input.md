---
change_id: deploy-init-release-caller
title: "init writes the release caller"
status: backlog
roadmap_item: DF-16
branch: null
created: 2026-10-06
updated: 2026-10-06
archived_at: null
---

## Intent

`softure-deploy init` writes `.github/workflows/release.yml`, the caller of `deploy-cut-release.yml` (DF-12), next to
the `deploy.yml` it already writes, so a new app can cut a release with *Run workflow* without copying
`tools/deploy/examples/release.yml` by hand. An existing file is kept, as for every file `init` writes.

## Context

From [`roadmap.md`](../../foundation/archive/2026-10-06-2-roadmap.md) (deploy-followups), item **DF-16**:

> - **Outcome:** `softure-deploy init` writes `.github/workflows/release.yml` (the caller of
>   `deploy-cut-release.yml`, as `tools/deploy/examples/release.yml`) next to the `deploy.yml` it already writes.
> - **Source:** DF-12 (`deploy-cut-release`), implementation review: `init` writes the deploy caller only.

## Constraints

- Touches `tools/deploy/templates/`, `tools/deploy/src/init/` and the e2e app (`npm run e2e-app -w @softure-ai/deploy`).
- Prerequisite: DF-12.

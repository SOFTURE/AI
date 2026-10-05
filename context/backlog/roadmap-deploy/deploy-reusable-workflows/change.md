---
change_id: deploy-reusable-workflows
title: "Reusable deploy workflows"
status: backlog
roadmap_item: DP-2
branch: null
created: 2026-10-04
updated: 2026-10-04
archived_at: null
---

## Intent

`workflow_call` workflows: build the image to GHCR, deploy over SSH, verify; an app keeps one `uses:` line.

## Context

From [`roadmap.md`](../../../foundation/roadmap.md) (deploy), item **DP-2** (main roadmap since 2026-10-05):

> ### DP-2: Reusable deploy workflows
> - **Change ID:** `deploy-reusable-workflows`
> - **Status:** ready
> - **Outcome:** Reusable GitHub workflows in this repository (`.github/workflows/deploy-*.yml`, `on: workflow_call`):
>   - build and push the image to GHCR with the release tag;
>   - deploy over SSH through the server's forced command, with env rendered by DP-1;
>   - verify (DP-4 once merged; a health check until then);
>   - inputs for the two domain spots FIRE hard-codes; secrets passed explicitly; minimal `permissions`;
>   - an example caller workflow and a test that validates the workflow files.
> - **Prerequisites:** DP-1.
> - **Unknowns:**
>   - Versioning for callers (`@v1` tag the owner moves vs. a commit SHA).
>   - Whether a reusable workflow in a private repository can be called by the owner's other repositories (organization setting).
> - **Risk:** medium. CI that deploys to production; a bad input reaches a live server.
> - **Baseline:** FIRE `.github/workflows/{release,auto-release}.yml` (381 lines, 2 domain spots). After: the same steps behind `workflow_call`, validated by actionlint in CI.
> - **PRD refs:** FR-33.
> - **Source (FIRE_TRACKER, read only):** `.github/workflows/release.yml`, `.github/workflows/auto-release.yml`

Reference material: [`docs/06-fire-extraction-2.md`](../../../../docs/06-fire-extraction-2.md) (the FIRE_TRACKER source map and the split rules),
[`docs/02-module-standard.md`](../../../../docs/02-module-standard.md) (the standard). FIRE_TRACKER is read only:
copy its code, never change it.

## Constraints

- Exclusively owns: `.github/workflows/deploy-*.yml`, `tools/deploy/examples/`.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.

## Notes

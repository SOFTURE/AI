---
change_id: deploy-reusable-workflows
title: "An app deploys to its VPS with one reusable workflow: build to GHCR, SSH deploy, verify"
status: archived
roadmap_item: DP-2
branch: claude/project-thread-kajtg5
created: 2026-10-05
updated: 2026-10-05
archived_at: 2026-10-05
---

## Intent

An app that deploys to one VPS adds one caller workflow whose job is a single `uses:` line pointing at
`SOFTURE/AI/.github/workflows/deploy-app.yml`. On a release tag that workflow builds the app's image and pushes it to
GHCR under the tag, renders `.env.prod` from the app's secrets with `softure-deploy env render` (DP-1), hands it to
the server's forced SSH command, and checks the app answers its health route. The app supplies its two domain spots
(the image name and the public URL) as inputs and its secrets explicitly; no step takes a value that was not
validated first. A reviewer can check it with actionlint in CI and the repository test over the workflow and the
example caller in `tools/deploy/examples/`.

## Context

From [`roadmap.md`](../../foundation/roadmap.md) (deploy), item **DP-2**:

> - **Outcome:** Reusable GitHub workflows in this repository (`.github/workflows/deploy-*.yml`, `on: workflow_call`):
>   - build and push the image to GHCR with the release tag;
>   - deploy over SSH through the server's forced command, with env rendered by DP-1;
>   - verify (DP-4 once merged; a health check until then);
>   - inputs for the two domain spots FIRE hard-codes; secrets passed explicitly; minimal `permissions`;
>   - an example caller workflow and a test that validates the workflow files.
> - **Unknowns:**
>   - Versioning for callers (`@v1` tag the owner moves vs. a commit SHA).
>   - Whether a reusable workflow in a private repository can be called by the owner's other repositories (organization setting).
> - **Risk:** medium. CI that deploys to production; a bad input reaches a live server.
> - **Baseline:** FIRE `.github/workflows/{release,auto-release}.yml` (381 lines, 2 domain spots). After: the same steps behind `workflow_call`, validated by actionlint in CI.

The taken backlog entry is kept as [`backlog-input.md`](backlog-input.md). The split between package, workflows and
app (owner, 2026-10-04) is in [`docs/06-fire-extraction-2.md`](../../../docs/06-fire-extraction-2.md). The existing
reusable workflow [`blog-links.yml`](../../../.github/workflows/blog-links.yml) is the house pattern (inputs passed
to scripts through `env`, a commented caller in the header).

## Constraints

- Exclusively owns: `.github/workflows/deploy-*.yml`, `tools/deploy/examples/`, `tests/repo/deploy-workflows.test.ts`.
  Also adds an actionlint job to `ci.yml` (no other item touches it).
- Does not touch `tools/deploy/src/` (DP-3 and DP-4 add their commands there in parallel).
- Nothing runs against a server, a secret or DNS: no real deploy from this repository. No tag or publish (DP-8 is
  the owner's).
- English-only code, comments and commits. FIRE_TRACKER is read only.

## Notes

- Placement: main roadmap deploy, item DP-2 (taken from `context/backlog/roadmap-deploy/`).
- Research: done (`research.md`), short: GitHub's reusable-workflow rules, the repository's visibility and the DP-1 CLI.
- Framing skipped: the problem and the split are fixed by the owner's roadmap item (2026-10-04); nothing about
  whether to build it is in doubt.
- Contract for DP-5 (the server script it generates): the forced command receives `<remote-command> <tag>` as
  `SSH_ORIGINAL_COMMAND` and the rendered `.env.prod` on stdin.
- DF-2 (FIRE parity of the workflow and gateway), DF-3 (`softure-deploy verify` in the verify job) and DF-4 (an
  end-to-end CI run) queued in `deploy-followups`.
- Archived 2026-10-05: `deploy-app.yml` and its example caller, waiting for the first publish of `@softure-ai/deploy` and the `deploy-workflows-v1` tag (DP-8).

---
change_id: deploy-workflow-verify-config
title: "The deploy workflow verifies with softure-deploy verify"
status: archived
roadmap_item: DF-2
branch: claude/project-thread-gaxu76
created: 2026-10-06
updated: 2026-10-06
archived_at: 2026-10-06
---

## Intent

After a release reaches the server, the `verify` job of `deploy-app.yml` first waits for the health route as today and
then runs `softure-deploy verify <app-url>` (DP-4) with the app's `deploy.json` read from the release tag, from the CLI
version the workflow pins. A route the app lists that answers wrong (a status, a marker, a redirect, a header) fails
the release run instead of passing on a green health route alone. A reviewer checks it with actionlint and the
repository test over the workflow.

## Context

From [`roadmap.md`](../../foundation/roadmap.md) (deploy-followups), item **DF-2**:

> - **Outcome:** The `verify` job runs `softure-deploy verify <app-url>` (DP-4) from the CLI version the workflow pins,
>   reading the app's `deploy.json` from the release tag; the health-route wait stays as the first step, so verify
>   starts once the new release answers.
> - **Prerequisites:** DP-4 on `master`.
> - **Unknowns:** whether `deploy.json` is required or optional (fall back to the health route).
> - **Risk:** low. Today the workflow checks only `/api/health`.
> - **Source:** DP-2 (`deploy-reusable-workflows`), implementation review.
> - **PRD refs:** FR-33.

The taken backlog entry is kept as [`backlog-input.md`](backlog-input.md). The workflow came from DP-2
([archive](../../archive/2026-10-05-deploy-reusable-workflows/change.md)), the `verify` command from DP-4
([archive](../../archive/2026-10-05-deploy-verify-production/change.md)), and `softure-deploy init` (DP-5) writes the
`deploy.json` starter at the app's root.

## Constraints

- Exclusively owns `.github/workflows/deploy-app.yml`, `tools/deploy/examples/` and
  `tests/repo/deploy-workflows.test.ts` while it runs; DF-7 takes the same files after this merges.
- Does not touch `tools/deploy/src/` (DF-5 and DF-6 change the `verify` schema and engine in parallel); the README's
  deploy workflow section and its DF-2 limitation line are the only package files touched.
- No real deploy, tag or publish. English-only code, comments and commits. FIRE_TRACKER is read only.

## Notes

- Placement: main roadmap deploy-followups, item DF-2 (taken from `context/backlog/roadmap-deploy-followups/`).
- Research: done (`research.md`), short: what the CLI does with a missing file and how the checkout fetches one file.
- Framing skipped: the problem and the fix are fixed by the roadmap item and DP-2's implementation review; nothing
  about whether to build it is in doubt.
- Archived 2026-10-06: the `verify` job of `deploy-app.yml` waits for the health route, then runs
  `softure-deploy verify` with the app's `deploy-config` (default `deploy.json`) from the tag; waiting for the first
  publish of `@softure-ai/deploy` (DP-8). No new gap.

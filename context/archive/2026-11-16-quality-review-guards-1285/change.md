---
change_id: quality-review-guards-1285
title: "jobs: no constant in a \"use server\" module, guard over every package; theme-flat-paint: no react peer (issues #1285, #1287)"
status: archived
archived_at: 2026-11-16
roadmap_item: null
issue: 1285
branch: claude/project-thread-rr724b
created: 2026-11-16
updated: 2026-11-16
---

## Intent

Close [issue #1285](https://github.com/SOFTURE/AI/issues/1285) and [issue #1287](https://github.com/SOFTURE/AI/issues/1287),
two findings of a whole-repository quality review (`QR-5eecbc9e`, `QR-60a7a98b`).

## Context

Labels: `bug`, `pkg: jobs`, `pkg: testing` (#1285); `bug`, `pkg: theme-flat-paint` (#1287). Packages: jobs 0.1.9,
theme-flat-paint 0.4.1. `findNonAsyncServerExports` of `@softure-ai/testing/guards/next` reports
`modules/jobs/src/next/actions.ts:77` (`PANEL_PAUSE_REASON`); no repository test runs the guard over the packages.
theme-flat-paint has no React code but names `react` as a peer, which the theme package contract requires. No version bump: the batch release follows.

## Scope

- jobs: `PANEL_PAUSE_REASON` moves to `src/next/panel-pause.ts`; `@softure-ai/jobs/next` exports it as before.
- `tests/repo/server-actions.test.ts`: every workspace package's `src/` passes `findNonAsyncServerExports`.
- `quality-review.ignore` at the root accepts `QR-60a7a98b`: the theme package contract (theme-kit README) requires
  the `react` peer, so the finding is a false positive (#1287).
- CHANGELOG `## Unreleased` of jobs.

## Constraints

- The public API of `@softure-ai/jobs/next` is unchanged.

## Notes

- Research: skipped. The guard's output names the line; the theme's sources were grepped for React (none).
- Framing: skipped. Both are mechanical slips.

## Done

- `@softure-ai/jobs`: `PANEL_PAUSE_REASON` lives in `src/next/panel-pause.ts`; `actions.ts` exports only async
  functions, so an app route that imports the admin actions builds. Export of `/next` unchanged. Next release of
  jobs (patch).
- `tests/repo/server-actions.test.ts` runs `findNonAsyncServerExports` over every workspace package's `src/`.
- `quality-review.ignore` accepts `QR-60a7a98b` (theme-flat-paint's `react` peer, required by the theme package
  contract); #1287 closes as a false positive.

---
change_id: ci-area-gated-jobs
title: "ci: the slow area jobs of ci.yml and e2e.yml run only when the change reaches their area"
status: archived
roadmap_item: null
issue: null
branch: claude/project-thread-y5szj5
created: 2026-11-04
updated: 2026-11-04
archived_at: 2026-11-04
---

## Intent

Save runner minutes and wait time on pull requests and master pushes that do not touch an area. After this change:

1. a `changes` job at the start of `ci.yml` and `e2e.yml` runs `scripts/ci/affected.mjs`, which lists the change's
   files through the GitHub API and decides which areas it reaches, following the workspace packages' shipped
   dependencies;
2. `ci.yml`: the two marketing-kit film jobs run only for the marketing-kit area, `host playbooks converge` only for
   the host area (the host package and the deploy CLI its converge script runs);
3. `e2e.yml`: the example app e2e, Stripe sandbox and container jobs run only when the change reaches a package the
   example app installs or `examples/`; the deploy init image job also when it reaches the deploy CLI;
4. a shared root file (lockfile, root manifest and configs, `scripts/`, composite actions, the two workflows), a
   manual run, a change list the API cut short, or a failure to list the files runs every area;
5. typecheck, lint, the unit and repository tests, the build and actionlint keep running on every pull request.

## Context

Owner request in the project thread (2026-11-04): review the other pipelines for runs that are not needed and run
the gates of an area only when the change touches it, to save minutes and time.

Review of `.github/workflows/`: `themes.yml`, `release.yml`, `e2e-deploy.yml` and (new) `macos.yml` already filter by
path; the others are reusable or manual. `ci.yml` and `e2e.yml` run every job on every pull request and again on the
master push after the merge. Most pull requests on 2026-11-04 touched only `tools/marketing-kit`, which the example
app does not install, yet each ran the four e2e jobs (about 15 runner minutes) and the host converge job.

## Constraints

- `ci.yml` keeps no workflow-level paths filter (its repository tests guard the Markdown too).
- No third-party action: the script uses Node built-ins and the `gh` CLI the runner ships.
- master has no required checks; a job skipped by `if:` reports as skipped.
- English only; no release.

## Notes

- Research: in this file and research.md (dependency facts). Framing: skipped, the owner named the outcome.

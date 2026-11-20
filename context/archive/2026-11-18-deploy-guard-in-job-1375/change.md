---
change_id: deploy-guard-in-job-1375
title: "deploy: guard-in-job folds the guard jobs into the job that does the work (issue #1375)"
status: archived
archived_at: 2026-11-18
roadmap_item: null
issue: 1375
branch: claude/project-thread-h2x91n
created: 2026-11-18
updated: 2026-11-18
---

## Intent

Let a release pipeline stop paying a whole billed minute for each guard job (`prepare` of
`deploy-release-checks.yml`, `check inputs` of `deploy-app.yml`) by running the same guard steps at the start of the
job that does the work. Opt-in; the default stays as it is.

## Context

Issue #1375 (`@softure-ai/deploy`, enhancement). GitHub and Ubicloud bill every job at least one minute plus its own
runner start; an adopting app's four releases a week pay 8 minutes for two guards whose work takes seconds.

## Scope

- `deploy-release-checks.yml`: input `guard-in-job` (boolean, default false). With it, `prepare` is skipped unless a
  shard list is needed (`unit` with more than one shard), and `static` and `unit` check the tag themselves (tag
  pattern, commit on the release branch) before their checkout. The workflow output `sha` also comes from them.
- `deploy-app.yml`: input `guard-in-job` (boolean, default false). With `build: true` and `deploy: false`, the
  `check` job is skipped and `build` runs its steps (input validation, branch guard) first; the outputs `release` and
  `sha` come from `build`. With `deploy: true` the input is refused (the deploy and verify jobs read the check job).
- Tests in `tests/repo/deploy-workflows.test.ts`, README, CHANGELOG, `examples/deploy-pipeline.yml` opts in, patch
  release with `deploy-cli-version` bumped.

## Constraints

- Default off: a caller that does not set the input runs exactly the jobs and steps it runs today.
- A guard that fails still fails before any checkout of the app's files, install or build.
- `deploy-release-checks.yml` keeps `contents: read`.

## Notes

- Frame skipped: the issue states the problem, the measurement and the proposal.

## Done

- `guard-in-job` in `deploy-release-checks.yml` and `deploy-app.yml`, opted into by `examples/deploy-pipeline.yml`, in
  `@softure-ai/deploy` 0.7.5 (released by `auto-release.yml` after the merge).

## Decisions (auto)

- One input name in both workflows, `guard-in-job`, as the issue proposed.
- `static` and `unit` each guard the tag themselves instead of `static` alone: `unit` needs the resolved commit for
  its checkout too, and the steps cost seconds in a job billed anyway.
- `deploy-app.yml` folds only with `deploy: false` (refused otherwise): the deploy, verify and summary jobs read the
  check job, and the pipeline the issue measures deploys from the caller's own job.
- The skip-the-repeat option (third in the issue) not taken: the check job would still run and bill its minute.
- Patch release (0.7.5): no CLI code changed, and a minor would fall outside dependents' `^0.7.0` ranges.

---
change_id: ci-macos-on-script-changes
title: "ci: the macOS shell script tests run only when the shell scripts change"
status: archived
roadmap_item: null
issue: null
branch: claude/project-thread-y5szj5
created: 2026-11-04
updated: 2026-11-04
archived_at: 2026-11-04
---

## Intent

The `macos` job of `ci.yml` (shell script tests on macOS, issue #177) runs on every pull request. When GitHub has
no macOS runner free it waits 15 minutes without a step, is cancelled, and the whole `ci` run turns red. After this
change:

1. the job lives in its own workflow, `macos.yml`, that runs on pull requests and pushes to master only when a file
   its tests execute or read changes (`tools/deploy/**`, `.github/workflows/**`, `.github/actions/**`, the
   repository test files it runs), plus on demand and once a week, so a new macOS runner image is caught too;
2. `ci.yml` has no macOS job, so an unrelated pull request neither waits for nor fails on a macOS runner;
3. `AGENTS.md` names the new workflow.

## Context

Owner decision in the project thread (2026-11-04): "only when the scripts change" (option chosen on a decision card).

Measured on the last 60 `ci` runs: when it gets a runner the job takes 1.5 to 3.5 minutes; since 15:25 UTC on
2026-11-04 four runs (pull requests #1038, #1039, #1040 and one more) got no runner, the job was cancelled after
15 minutes with no step and the run concluded `failure`; the same happened twice on 2026-11-03. The longest `ci` job
is `unit and repository tests` (18 to 26 minutes), which the change does not touch. The same tests already run on
Linux in the `test` job; the macOS job only catches a bash 4 or GNU-only feature that would turn `npm test`
(the pre-push hook) red on a Mac.

## Constraints

- English only; neutral wording.
- The macOS job keeps its steps (system tools first in `PATH`, the same vitest command).
- `ci.yml` keeps its triggers and its no-paths-filter rule (`tests/repo/ci-workflows.test.ts`).
- No release; no repository settings change (master has no required checks).

## Notes

- Research: kept short in research.md; the facts are the run history above and the files the tests read.
- Framing: skipped. The owner chose the outcome.

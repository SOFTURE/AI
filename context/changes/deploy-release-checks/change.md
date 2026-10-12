---
change_id: deploy-release-checks
title: "deploy: reusable release-check and release-notes workflows (issue #406)"
status: planned
roadmap_item: null
issue: 406
branch: claude/project-thread-6rozxi
created: 2026-10-12
updated: 2026-10-12
---

## Intent

Close [issue #406](https://github.com/SOFTURE/AI/issues/406) (labels `enhancement`, `pkg: deploy`, `adoption`).
`deploy-app.yml`, `deploy-integration.yml` and `deploy-cut-release.yml` cover the deploy, the integration run and
cutting a release, yet an adopting app still owns about 350 lines of YAML that every app repeats:

1. release prepare: the tag matches `vYYYY.MM.DD` (`-N` on a collision) and its commit is on the main branch;
2. static: `tsc --noEmit` and lint, with Next's type generation first (a fresh checkout has no `.next/types`);
3. unit tests split into N shards (one job exceeds 45 minutes on a hosted runner);
4. the image built and pushed to GHCR as `sha-<sha>` for the deploy job to re-tag;
5. a `workflow_dispatch` that replaces a release body (`tag`, `body`): agent sessions cannot edit releases over REST;
6. a manual tests workflow: `static` on pull requests, the unit tests on demand or by a label.

Outcome:

- `.github/workflows/deploy-release-checks.yml` (`workflow_call`): `prepare` (inputs, tag pattern, tag on the release
  branch, the shard list), `static`, `unit` (a matrix of `shards`), `build` (optional, pushes `<image>:sha-<sha>` and
  outputs `prebuilt-image` = `<image>@sha256:<digest>`, which `deploy-app.yml` takes as is). With an empty `tag` it
  checks the caller's commit, for pull requests.
- `.github/workflows/deploy-release-notes.yml` (`workflow_call`): replaces the body of one release.
- Callers: `tools/deploy/examples/{checks,release-notes}.yml`, and `softure-deploy init` writes the same two files
  pinned by `--workflows-ref`.

A reviewer checks `tests/repo/deploy-workflows.test.ts`, `src/init/generate.test.ts`, the README "Deploy workflow"
subsections and the CHANGELOG `Unreleased` entry.

## Context

deploy is at 0.1.10 on master; #405 (run --local) merged as PR #416. Releases are batched by the coordinator: no
version bump, CHANGELOG `## Unreleased`. Every input default that names the CLI version stays as is.

## Constraints

- The same guards as the other deploy workflows: `workflow_call` only, permissions at the top and on every job,
  `packages: write` only on a job named `build`, `contents: write` only on the job that edits a release, no input
  or event value interpolated into a script, everything through `env:`.
- Scripts stay within bash 3.2 (the repository tests run them on macOS).
- `deploy-app.yml` and the generated `deploy.yml` are unchanged: gating the deploy on the checks is the app's choice,
  documented as a snippet.

## Process notes

- Framing: skipped. The issue lists each gap and names the expected workflows.

## Decisions (auto)

- One checks workflow, not three: `prepare`, `static`, `unit` and `build` share the resolved commit, and the app's
  manual tests workflow is the same file called with `tag: ""` and `unit` on demand. Names: `deploy-release-checks.yml`
  and `deploy-release-notes.yml` (the `deploy-` prefix puts them under the shared guards of the repository test).
- Commands are inputs run with `bash -e -c` from `env:` (`install-command`, `static-command`, `test-command`); the
  test command reads `SHARD_INDEX` and `SHARD_COUNT` (default `npm test -- --shard="$SHARD_INDEX/$SHARD_COUNT"`,
  which Vitest takes). `shards` is 1 to 20.
- The default tag pattern is `^v[0-9]{4}\.[0-9]{2}\.[0-9]{2}(-[0-9]+)?$`, the tags `deploy-cut-release.yml` cuts;
  `tag-pattern` overrides it.
- `build` runs only when `build-image` is on and `static` and `unit` succeeded or were turned off. The image tag is
  `sha-<sha>`; the output is by digest so the deploy re-tags exactly the tested bytes.
- `init` writes `checks.yml` (pull request: static; `workflow_dispatch` or the `run-tests` label: unit too) and
  `release-notes.yml`. The generated static command runs `next typegen` first: init's apps are Next apps.
- The release-notes workflow replaces the body only (`gh release edit --notes-file`); an empty body is refused.

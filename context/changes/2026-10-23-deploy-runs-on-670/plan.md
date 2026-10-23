---
change_id: deploy-runs-on-670
status: in_progress
---

# Plan: a runs-on input on every reusable workflow (issue #670)

Input: change.md, research.md. Complexity: small (workflow YAML, one repository test file, docs).

## Phase 1: the guard and the check (TDD)

Files: `tests/repo/deploy-workflows.test.ts` (or a new `tests/repo/workflow-runners.test.ts`).

1. Tests first, over every reusable workflow (`workflow_call`): a `runs-on` input of type string with default
   `'"ubuntu-latest"'`; every job reads `${{ fromJSON(inputs.runs-on) }}`; every job's first step is the one
   "Check the runner" step, identical in every file.
2. Run that step: `"ubuntu-latest"`, `["self-hosted","linux"]` and spaced variants pass; not JSON, an object, an
   empty array, an array with a number, an empty label fail with an error that names `runs-on`.

## Phase 2: the workflows

Files: the nine workflows, `.github/workflows/e2e-deploy.yml`.

1. Add the input (description names both forms) and `runs-on: ${{ fromJSON(inputs.runs-on) }}` to every job; the
   check step (`&check-runner` in the first job, `*check-runner` in the others).
2. `e2e-deploy.yml`: a `checks` job calls `deploy-release-checks.yml` with `runs-on: '["ubuntu-latest"]'` and a
   trivial install and static command (the array form on a real runner, about a minute); add the workflow to its
   paths.

## Phase 3: docs

Files: `tools/deploy/README.md`, `tools/deploy/CHANGELOG.md`, `modules/blog/README.md`, `modules/blog/CHANGELOG.md`.

1. README "Runner (self-hosted)": the input, both forms, that a value that is not JSON fails before any step, what
   a self-hosted runner must provide (Docker with buildx; passwordless `sudo` or Playwright system deps; a clean state
   between jobs), and why a public repository must not use one.
2. CHANGELOG entries under Unreleased (additive, default unchanged).

## Decisions (auto)

- A separate identical check step instead of nine edited input checks (research, option 2).
- `blog-links.yml` belongs to `@softure-ai/blog`; it gets the same input and its README a line.
- The e2e check calls the workflow with trivial commands: the point is the runner wiring, the checks themselves are
  covered by the repository's own CI.
- (During implementation) The step is anchored (`&check-runner`) only in files with several jobs; actionlint refuses
  an anchor nobody uses, so single-job files carry the step plainly. The guard compares every job's first step with
  `deploy-release-checks.yml`'s, so the copies cannot drift.
- (During implementation) `deploy-workflows.test.ts` reads every job's steps after the runner check (its `readYaml`
  drops it), so the tests of each workflow's own first step stay as they are.

## Progress

- [x] Phase 1: the guard and the check (bb21cbe)
- [x] Phase 2: the workflows (5e0c491)
- [x] Phase 3: docs (17731d2)

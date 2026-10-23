---
change_id: deploy-gh-self-hosted-686
status: archived
---

# Plan: the reusable workflows install the GitHub CLI when the runner has none (issue #686)

Input: change.md, research.md. Complexity: small (workflow YAML, one repository test file, docs).

## Phase 1: the guard and the step's behaviour (TDD)

Files: `tests/repo/workflow-runners.test.ts`, `tests/repo/deploy-workflows.test.ts`.

1. Tests first: every job of a reusable workflow whose `run` scripts call `gh` has, as its second step, the one
   "Set up the GitHub CLI" step, identical in every file; no other job carries it.
2. Run the step's script: `gh` on `PATH` → exit 0, no output, `$GITHUB_PATH` untouched; `RUNNER_OS`/`RUNNER_ARCH`
   other than Linux X64/ARM64 → error naming `gh`; missing `curl` → error naming it; failed download → error; wrong
   checksum → error, nothing on `$GITHUB_PATH`; matching archive → its `bin` on `$GITHUB_PATH`.
3. `deploy-workflows.test.ts` reads each job's steps after the shared steps (as it does after the runner check).

## Phase 2: the workflows

Files: `deploy-cut-release.yml`, `deploy-report.yml`, `deploy-release-notes.yml`, `deploy-cancel-run.yml`,
`deploy-integration.yml`.

1. Add the step after "Check the runner" in the five jobs. GitHub CLI 2.103.0, SHA-256 per architecture pinned;
   install under `$RUNNER_TEMP/gh-<version>`, add `bin` to `$GITHUB_PATH`, print the installed version.

## Phase 3: docs

Files: `tools/deploy/README.md` (Runner section), `tools/deploy/CHANGELOG.md`.

1. README: which jobs need `gh`, that they install the pinned copy on a Linux x64/arm64 runner without it, what else
   the runner needs, and that an app's own `gh` steps must install it themselves.
2. CHANGELOG: Unreleased, Fixed.

## Decisions (auto)

- Option 1 of research (install when missing) with clear failures, over a preflight-only check or a curl rewrite.
- Linux x64 and arm64 only; other platforms fail with a message to install `gh` on the runner.
- One identical step guarded by the repository test, as the runner check is, instead of a composite action (a
  reusable workflow called from another repository would need the action at a pinned ref of this repository).

## Progress

- [x] Phase 1: the guard and the step's behaviour (15d477a)
- [x] Phase 2: the workflows (6e41ffd)
- [x] Phase 3: docs (1ffb719)

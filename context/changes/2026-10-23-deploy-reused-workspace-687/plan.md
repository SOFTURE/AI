---
change_id: deploy-reused-workspace-687
status: in_progress
---

# Plan: empty workspace per job on a reused runner (issue #687)

Input: change.md, research.md. Complexity: small (one step repeated, one test, docs).

## Phase 1: the step and its test (TDD)

Files: `tests/repo/workflow-runners.test.ts`, `.github/workflows/deploy-*.yml`, `.github/workflows/blog-links.yml`.

1. Test first: every job of a reusable workflow that uses `actions/checkout` runs the step "Empty the workspace"
   before its first checkout, with the same script and `working-directory: ${{ runner.temp }}` everywhere; the script
   removes files, dot files and folders (a `.git` included) but keeps the workspace folder; it fails, naming the
   workspace, when an entry cannot be removed; it refuses an unset `GITHUB_WORKSPACE`.
2. The step: right after "Check the runner" in each such job (a YAML anchor per file where the file already uses
   anchors). `find "$GITHUB_WORKSPACE" -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +`, with an `::error::` that names
   the cause (files of another user, e.g. a container's volume) and the runner-side fix.

## Phase 2: docs

`tools/deploy/README.md` "Runner": each job empties the workspace first; the app's own jobs on the same runner need
the same (a job-started hook or ephemeral runners), and why (a sparse checkout outlives the next full one).
`tools/deploy/CHANGELOG.md` `## Unreleased`: the fix and what an app does (nothing for the reusable workflows; its own
jobs per README).

## Decisions (auto)

- Option 1 of research.md over separate `path:` clones: it fixes every sparse/full pair and work directories already
  left sparse by earlier runs.
- Unconditional, not only for non-hosted labels: a label does not tell a hosted runner from a self-hosted one, and on a
  hosted runner the step costs a `find` over an empty folder.

## Progress

- [ ] Phase 1: the step and its test
- [ ] Phase 2: docs

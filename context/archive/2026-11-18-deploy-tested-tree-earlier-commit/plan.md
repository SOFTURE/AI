# Plan: deploy-tested-tree-earlier-commit

## Approach

Move the tree comparison and the check-run reading into `check_commit`, which returns passed, not passed (with a
reason), or doubt. Try the newest commit first; when it does not pass, list the pull request's commits and try at most
10 earlier ones, newest first. The first that passes answers `"true"` and becomes `head-sha`; a doubt stops the
search; otherwise the answer is `"false"` with the newest commit's reason, so every earlier message stays as it was.

## Phase 1: workflow, tests, docs, release (TDD on the fake API)

- Tests: an earlier commit passes while the head skipped; earlier code differs; no earlier commit passed; commits,
  tree or check runs unreadable; a doubt stops the search; at most 10 earlier commits.
- Done when: the deploy-tested-tree tests and the repository gates pass.

## Progress

- [x] 1.1 Workflow, tests, docs and 0.7.6 (this commit)

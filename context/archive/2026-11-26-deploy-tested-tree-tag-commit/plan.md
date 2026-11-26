# Plan: deploy-tested-tree-tag-commit

## Approach

Split the check-run reading out of `check_commit` into `check_runs <commit> <subject>` (same messages for a pull
request). Before the pull requests, call it on the tag's commit: success answers `"true"` with `head-sha` = the tag's
commit and an empty `pull-request`; anything else (a red, skipped or missing check, an unreadable answer) goes on
silently. Collect up to 5 merged pull requests of the tag's history (a compare failure after the first one stops the
collection instead of answering). Try the last one exactly as before (`try_pull_request`: newest commit, then 10
earlier ones). When it does not pass, walk the older ones while each merge commit's tree equals the tag's outside the
ignored folders; stop at a difference or any doubt. The final `"false"` keeps the last pull request's number, commit
and reason, so every existing message stays.

## Phase 1: workflow, tests, docs, release (tests on the fake API)

- Tests: green checks on the tag's commit answer true without reading pull requests; a red, skipped or missing check
  there goes on to the pull request; an archive-only last pull request lets the older one answer; an older merge commit
  with other code, or an unreadable one, stops the walk; a compare failure after the first pull request keeps what was
  found; at most 5 pull requests.
- Done when: `tests/repo/deploy-workflows.test.ts` and the repository gates pass.

## Progress

- [x] 1.1 Workflow, tests, docs and deploy 0.7.10 (this branch; `npx vitest run tests/repo/deploy-workflows.test.ts`:
  319 passed)

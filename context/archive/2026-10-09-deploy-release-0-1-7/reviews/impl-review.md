# Implementation review: deploy-release-0-1-7

Reviewed: the branch diff against plan.md and issue #307.

- D1: `tools/deploy/package.json` and the lockfile entry at 0.1.7.
- D2: CHANGELOG heading `## 0.1.7`, no `## Unreleased` left.
- D3: the three reusable deploy workflows default `deploy-cli-version` to 0.1.7 (pinned by
  `tests/repo/deploy-workflows.test.ts`).
- D4: README `git ls-remote` example names `deploy@0.1.7`.

## Findings

None.

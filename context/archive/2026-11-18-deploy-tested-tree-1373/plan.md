# Plan: deploy-tested-tree-1373

One phase, test-after.

## Phase 1: the workflow

- `deploy-tested-tree.yml`: shared runner, workspace and gh steps; checkout of the tag (full history, sparse
  `/package.json`); step `find` walks first-parent commits to a merged pull request, takes its newest commit whose named
  check runs all succeeded, and answers `true` only when the diff to the tag is inside `ignore-prefixes`.
- Tests, README, CHANGELOG, version 0.7.4.

Done when: `npx vitest run tests/repo` green, CI green.

## Decisions (auto)
- A separate workflow, not an input of `deploy-release-checks.yml`: it needs `pull-requests` and `checks: read`, which
  a pull request's caller of the checks does not grant.
- Default `ignore-prefixes: context/`, `depth: 10`.

## Progress

### Phase 1: the workflow

#### Automated
- [x] 1.1 Workflow and tests (15 new, workflow-runners and deploy-workflows green)
- [x] 1.2 README, CHANGELOG, 0.7.4

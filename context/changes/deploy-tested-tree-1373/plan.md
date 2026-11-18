# Plan: deploy-tested-tree (#1373)

## Approach

One reusable workflow with one API-only job (`compare`): check the runner, set up `gh`, check the inputs (invalid ones
fail), then one script that resolves the tag, finds the last merged pull request whose merge commit is an ancestor of
the tag, compares the two trees outside `ignore-prefixes` and reads the head's check runs. Every doubt writes
`tested=false` with a notice and exits 0.

## Phases

### Phase 1: workflow and tests (test-first)

- `tests/repo/deploy-workflows.test.ts`: shape (inputs, outputs, permissions `contents`, `pull-requests`, `checks`
  read, top level `{}`), input refusals, and the script against a stub `gh` serving JSON fixtures through real `jq`:
  equal trees with a changed `context/` file → true; code changed → false naming the path; a red, missing or running
  check → false; glob names; a newer pull request merged after the tag is passed over; a truncated tree, an API error,
  no merged pull request → false, exit 0.
- `tests/repo/workflow-runners.test.ts`: the new job in the list of jobs that call `gh`.
- `.github/workflows/deploy-tested-tree.yml`.
- Done when: `npx vitest run tests/repo/deploy-workflows.test.ts tests/repo/workflow-runners.test.ts` passes.

### Phase 2: caller, docs, release

- `tools/deploy/examples/deploy-pipeline.yml`: a `tested` job; `unit` skipped when tested; `build` runs on a skipped
  `unit` only when `tested` says so; a watcher for `tested`. Its tests updated.
- README ("Release checks", "Fail fast", "Runner" list), CHANGELOG 0.7.4, version bump and `deploy-cli-version`.
- Done when: typecheck, lint and the repository tests pass.

## Progress

- [x] Phase 1: workflow and tests (1c7ea81e)
- [x] Phase 2: caller, docs, release (SHA_P2)

Evidence: `npx vitest run tests/repo` 32 files, 1215 tests green; `npx vitest run tools/deploy` 53 files, 962 tests
green; typecheck, ESLint and the language gate clean (pre-commit). The compare script run against the live API of
SOFTURE/AI: `master` (merge of #1370) answered `tested=true` for `unit and repository tests (*)` and `build packages`;
the merge of #1365, whose head was behind master, answered `false` naming 34 differing files.

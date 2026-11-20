# Plan: SOFTURE/AI reviews itself

## Approach

One caller workflow modelled on `tools/quality-review/examples/quality-review.yml`, with a local `uses:` so a run
uses the workflow and prompt of its own commit.

## Phases

### Phase 1: workflow, test, README (test-after)

- `.github/workflows/quality-review-self.yml`.
- `tests/repo/quality-review-workflow.test.ts`: the caller starts only by hand, has empty top-level permissions,
  grants the job `contents: write` and `pull-requests: write`, passes only `ANTHROPIC_API_KEY` and only inputs the
  reusable workflow declares.
- `tools/quality-review/README.md` (Adoption): one paragraph naming the self caller and the public-report caveat.
- Done when: `npx vitest run tests/repo/quality-review-workflow.test.ts tests/repo/workflow-runners.test.ts
  tests/repo/ci-workflows.test.ts` passes; lint and the language gate are clean.

## Progress

- [x] Phase 1: workflow, test, README

Evidence: `npx vitest run tests/repo/quality-review-workflow.test.ts tests/repo/workflow-runners.test.ts
tests/repo/ci-workflows.test.ts` 3 files, 145 tests green.

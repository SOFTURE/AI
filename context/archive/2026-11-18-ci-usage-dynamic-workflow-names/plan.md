# Plan: ci-usage-dynamic-workflow-names

## Approach

`getWorkflowName(job)` in `usage.ts`: a `dynamic/...` path maps to a readable name from a small table, any other
dynamic path is named by the path itself, and a workflow file keeps its own name. `summarizeUsage` uses it for the
workflow bucket and the longest jobs. Version 0.1.2 with the workflow's `cli-version` default.

## Phases

### Phase 1: stable names (TDD)

- `tools/ci-usage/src/usage.ts`, `src/index.ts` (export), `tests/usage.test.ts`.
- Done when: `vitest run tools/ci-usage` green.

## Progress

- [x] Phase 1: stable names (see the commit; `vitest run tools/ci-usage`: 83 tests green, new: `getWorkflowName`
  and one bucket for two CodeQL runs with different titles)

## Decisions (auto)

- An unknown dynamic workflow is named by its path: stable and still recognisable, no guessing.

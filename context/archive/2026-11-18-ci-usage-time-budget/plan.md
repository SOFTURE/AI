# Plan: ci-usage-time-budget

## Approach

`collectRepository` reads the jobs of the runs that need a request in batches of `JOB_CONCURRENCY` (8), oldest
first. A batch with a budget result stops the collection at the first such run (the runs before it are counted, the
rest are not). Before each batch the collector checks an optional `deadline` (a `Date`, with a `now` function for
tests); past it, it stops and records "stopped at the time budget: N of M runs not counted". The CLI gains
`--max-minutes <n>` (whole number, 1 or more; no budget when unset), the reusable workflow passes `max-minutes` (new
input, default `"10"`), and the package becomes 0.1.1 with the workflow's `cli-version` default.

## Phases

### Phase 1: concurrency and the time budget (TDD)

- `tools/ci-usage/src/collect.ts`: `CollectOptions.deadline?: Date`, `now?: () => Date`; batched job reads.
- `tools/ci-usage/src/cli/command.ts`: `--max-minutes`, validated; deadline = now + minutes; usage text.
- Tests in `tools/ci-usage/tests/collect.test.ts` and `command.test.ts`: jobs read concurrently (more than one
  request in flight), counted set stays oldest-first on a budget stop, the deadline stops before the next batch with
  the exact note, `--max-minutes` validation.
- Done when: `vitest run tools/ci-usage` green.

### Phase 2: workflow, docs, version

- `.github/workflows/ci-usage.yml`: input `max-minutes` (default `"10"`, checked as a whole number from 1 to 14),
  passed to the CLI; `cli-version` default 0.1.1. README inputs table and CLI synopsis; CHANGELOG 0.1.1;
  `tests/repo/ci-usage-workflow.test.ts` covers the input.
- Done when: `tests/repo` green, actionlint clean.

### Phase 3 (after merge): release and live check

- `auto-release.yml` with `ci-usage` publishes 0.1.1 through the trusted publisher; dispatch `ci-usage-self.yml`;
  the run ends green within 15 minutes with the artifact and the `ci-usage` issue.

## Progress

- [x] Phase 1: concurrency and the time budget (6308f8a; `vitest run tools/ci-usage`: 80 tests green, new: 8 in
  flight, reserve stop between batches "2 of 10", time budget stop "1 of 10", `--max-minutes` stop and validation)
- [x] Phase 2: workflow, docs, version (2ab9da1, version bump fa08d7b; `tests/repo/ci-usage-workflow.test.ts` green,
  typecheck, ESLint and the language gate green in the pre-commit hook; actionlint runs in CI)
- [x] Phase 3: release 0.1.1 and the live run (after the merge: auto-release, then dispatch `ci-usage-self.yml`) — done: tag `ci-usage@0.1.1` on merge 66b3f25c (#1367); `ci-usage-self.yml` dispatched runs 44361164568 and 44374079068 succeeded on 2026-11-18

## Decisions (auto)

- Concurrency 8: well under GitHub's secondary limit, enough to read 1,150 runs in a few minutes.
- Budget default 10 minutes in the workflow, none in the CLI (a laptop run can take as long as it needs).

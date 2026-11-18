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

- [ ] Phase 1: concurrency and the time budget
- [ ] Phase 2: workflow, docs, version
- [ ] Phase 3: release 0.1.1 and the live run

## Decisions (auto)

- Concurrency 8: well under GitHub's secondary limit, enough to read 1,150 runs in a few minutes.
- Budget default 10 minutes in the workflow, none in the CLI (a laptop run can take as long as it needs).

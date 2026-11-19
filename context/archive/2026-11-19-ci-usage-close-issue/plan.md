# Plan: ci-usage-close-issue

## Approach

A `close` option on `publishReport` (CLI `--close`, workflow input `close-issue`, default `false`): the lookup reads
`state: "all"`, the body update carries the closed state, and a newly created issue is closed after its first
comment. Without the option nothing changes. Version 0.1.3 with the workflow's `cli-version` default.

## Phases

### Phase 1: close option (TDD)

- `tools/ci-usage/src/publish.ts`, `src/cli/command.ts`, `tests/publish.test.ts`, `tests/command.test.ts`,
  `.github/workflows/ci-usage.yml`, README, CHANGELOG, version.
- Done when: `vitest run tools/ci-usage`, typecheck and lint green.

## Progress

- [x] Phase 1: close option (see the commit; `vitest run tools/ci-usage`: 87 tests green, new: reuse a closed issue
  and keep it closed, close a new issue after its comment, default looks at open issues only, CLI `--close`)

## Decisions (auto)

- Default `false`: an app that does not act on its report keeps today's behaviour; opting in is one input.
- The new issue is closed after its first comment, so the run's history comment is in before the state changes.

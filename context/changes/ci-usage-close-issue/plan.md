# Plan: ci-usage-close-issue

## Approach

`PublishOptions.close?: boolean`. After the comment, when `close` is set, `publishReport` PATCHes the issue to
`state: closed, state_reason: completed`; a refused close is returned as a value naming the request, like every
other write. `PublishResult` gains `closed: boolean`. The CLI `publish` gains `--close` and prints
`created|updated <url>` plus ` (closed)`. The reusable workflow gains the boolean input `close-issue` (default
`false`) and passes `--close` when it is true. README (inputs, reading the report, CLI), CHANGELOG 0.2.0, the
workflow's `cli-version` default 0.2.0, and SOFTURE/AI's own `ci-usage-self.yml` sets `close-issue: true`.

## Phases

### Phase 1: close after publishing (TDD)

- `tools/ci-usage/src/publish.ts`, `src/cli/command.ts`, tests in `tests/publish.test.ts` and `tests/command.test.ts`:
  close after the comment (exact request order and body), no close by default, a refused close as a value,
  `--close` through the CLI with its output line.
- Done when: `vitest run tools/ci-usage` green.

### Phase 2: workflow, docs, version

- `.github/workflows/ci-usage.yml` input `close-issue` and the `--close` flag; `ci-usage-self.yml` `close-issue:
  true`; `tests/repo/ci-usage-workflow.test.ts` covers both; README, CHANGELOG 0.2.0, version 0.2.0 with the
  workflow's `cli-version` default.
- Done when: `tests/repo` green, typecheck and lint green.

### Phase 3 (after merge): release and live check

- `auto-release.yml` with `ci-usage` publishes 0.2.0; dispatch `ci-usage-self.yml`; the run is green and its report
  issue ends closed as completed.

## Progress

- [ ] Phase 1: close after publishing
- [ ] Phase 2: workflow, docs, version
- [ ] Phase 3: release 0.2.0 and the live run

## Decisions (auto)

- Close last (after the comment), so a failed close still leaves a complete, published report.
- Minor bump 0.2.0: a new option, no dependents to break.
- SOFTURE/AI's own caller closes its issues (the owner already closes them by hand after reading).
- The issue intro text stays as it is, so an app's own message dictionary keeps its shape.

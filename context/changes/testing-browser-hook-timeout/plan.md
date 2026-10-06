# Plan: testing-browser-hook-timeout

## Approach

Option A from [`research.md`](research.md): Vitest's hook limit becomes a global 60 s next to `testTimeout`, with
the measurement in the comment, and the three tests in `playwright-browser.test.ts` that lower their own limit to
15 s inherit the global one. No test is skipped, retried or weakened.

## Decisions

- **D1. Global, not per hook.** The cause is a configuration gap (hooks 10 s, tests 60 s), not this file; every
  `beforeAll` runs on the same loaded runner. One line in `vitest.config.mts` closes it for all of them.
- **D2. 60 s, the same as `testTimeout`.** Measured launch: 0.10–0.24 s in the cloud container, idle or beside the
  full suite; on the 4-core CI runner beside the marketing-kit browser tests it exceeded 10 s in 3 runs on
  2026-10-06. The hook's real time on the runner is measured once more in this change's CI run (phase 1) and goes
  into the comment. 60 s keeps a wide margin over both and fails a hung launch within a minute.
- **D3. Drop the `15_000` arguments.** They lower the limit (research finding 5); inheriting 60 s matches D2.
- **D4. Measure on CI with a temporary log**, removed in phase 2: the hook prints its duration once per run. A log
  line left in the suite would be noise.

## Phases

### Phase 1: global hook limit, measured on the runner (test-after)

- `vitest.config.mts`: `hookTimeout: 60_000` with a comment (why, the local measurement, the CI evidence).
- `foundation/testing/tests/playwright-browser.test.ts`: drop the three `15_000` arguments; temporarily log the
  `beforeAll` duration (`server` and `launch` in ms) with `console.info`.
- `tests/repo/test-environment.test.ts`: a test that hooks get the same limit as tests, reading the exported config
  of `vitest.config.mts` (`test.hookTimeout` equals `test.testTimeout`); red before the config line, green after.
- Check the guard before the fix: with `hookTimeout` at its default and a `beforeAll` that waits 11 s, the file fails
  with "Hook timed out in 10000ms"; with the new config it passes (scratch test, not committed).
- Done when: typecheck, lint, the testing package's tests and the full `npm test` are green locally; the PR's
  `ci` run prints the hook's duration.

### Phase 2: measurement into the comment

- Remove the temporary log; write the CI duration into the `vitest.config.mts` comment.
- Done when: gates green; the comment names the local and CI numbers.

## Progress

- [x] Phase 1: global hook limit, measured on the runner
- [ ] Phase 2: measurement into the comment

---
change_id: jobs-attempt-hook-1215
status: in_progress
---

# Plan: jobs per-attempt outcome hook (issue #1215)

Input: change.md, research.md. Complexity: small.

## Phase 1: hook

- `contract.ts`: `JobAttemptOutcome` (`JobOutcome["kind"]` without `stale`) and `JobAttemptEvent { queue, jobId,
  origin, attempt, maxAttempts, outcome, code, durationMs, at }`.
- `options.ts`: `onJobAttempt` option and `OnJobAttemptHook`.
- `server/hooks.ts`: `notifyJobAttempt`, through `runHook`.
- `server/process.ts`: `record()` runs it after the recorded write (not for `stale`), with the duration from the
  attempt's start.
- `testing`: `recordJobHooks()` records `attempts`. Exports in `index.ts` and `server/index.ts`.

## Phase 2: tests, docs, release notes

- `tests/attempt-hook.test.ts`: succeeded with duration and origin; retried twice then failed; `failJob`, a throw and
  an invalid payload with their codes; `pauseQueueLater` as `paused`; a throwing hook logged, job unchanged; a
  non-function refused at config load.
- README options row and §3 "Per-attempt metrics" (an OpenTelemetry example); CHANGELOG 0.1.9.

## Acceptance

- Gates: typecheck, lint, test, build.

## Decisions (auto)

- Proposal 1 (the hook), not built-in instruments: no new dependency, the app keeps its own metric names.
- `paused` is its own outcome (the issue lists it), although the run log calls it `retried`.
- The event adds `origin` (schedule, app, manual): cheap and useful as a label.
- The hook runs after `onJobFailed` / `onQueuePaused` of the same attempt, awaited like them.
- Patch release 0.1.9: additive, and a minor would leave the dependents' `^0.1` ranges.

## Progress

- [ ] Phase 1
- [ ] Phase 2

---
change_id: jobs-queue-pacing-breaker-955
status: archived
---

# Plan: queue pacing and a circuit breaker (issue #955)

Input: change.md, research.md (option 3). Complexity: medium (one package: migration, claim, completion, options,
hook, panel, docs).

## Phase 1: state, options, pacing and pauses in the claim (TDD)

Files: `migrations/0007_create_queue_state.sql`, `src/schema.ts`, `src/options.ts`, `src/contract.ts`, `src/index.ts`,
`src/server/queue-state.ts` (new), `src/server/claim.ts`, `src/server/index.ts`, `tests/queue-state.test.ts` (new).

- Table `queue_state(queue pk, next_allowed_at, window_started_at, window_count, consecutive_failures, pause_source
  ('breaker' | 'handler' | 'operator'), pause_reason, paused_until, last_pause_seconds, created_at, updated_at)` with
  checks (a pause has a source and a reason; only an operator pause may have no end).
- Queue options `rateLimit: { minGapMs, jitterMs? } | { max, perSeconds }` and `breaker: { failures, codes?,
  pauseSeconds, maxPauseSeconds? }` (default `maxPauseSeconds`: 16 × `pauseSeconds`, at most 7 days).
- `claimJobs`: an active pause claims nothing. A paced queue claims in a transaction holding its `queue_state` row
  `FOR UPDATE`: `minGapMs` claims one job when `next_allowed_at` has passed and moves it by the gap plus up to
  `jitterMs`; `{ max, perSeconds }` claims at most what the fixed window has left. `random` joins `ClaimJobsInput`.
- `pauseQueue(ctx, queue, { until?, reason })` and `resumeQueue(ctx, queue)`; `getQueuePause`. `jobs.unknown_queue`.
- Tests: two claims inside the gap claim one job; the jitter; the window; a pause claims nothing and keeps attempts;
  resume; an operator pause without an end; a later shorter pause does not shorten a longer one.

## Phase 2: the breaker, `pauseQueueLater` and `onQueuePaused` (TDD)

Files: `src/handlers.ts`, `src/contract.ts`, `src/options.ts`, `src/server/claim.ts`, `src/server/process.ts`,
`src/server/hooks.ts`, `src/server/queue-state.ts`, `src/testing/index.ts`, `tests/queue-state.test.ts`.

- `completeJob` updates the breaker in its transaction for a queue with `breaker`: a counted failure (a retry or a
  terminal failure, not `failJob` nor an invalid payload; only `codes` when given) adds one; at `failures` the queue
  pauses for `pauseSeconds`; a counted failure after a breaker pause and before a success pauses again for twice the
  last pause, up to `maxPauseSeconds`; a failure while already paused only counts; a success resets both.
- `pauseQueueLater(code, seconds)`: the job goes back to pending with its attempt given back, due when the pause ends;
  the run row is `retried` with the code; the queue pauses (source `handler`) for `seconds`, never shortening a pause.
- `onQueuePaused({ queue, code, until, source })` after the commit, for breaker and handler pauses; a throw is logged.
  `recordQueuePaused` in `/testing`.
- Tests: trip at N, growth and cap, reset on success, codes filter, failJob not counted, handler pause gives the
  attempt back, hook called once per pause, a throwing hook logged.

## Phase 3: stats, admin page and docs

Files: `src/server/maintenance.ts`, `src/next/actions.ts`, `src/next/pages.tsx`, `src/next/panel-rows.ts`,
`src/ui/jobs-panel.tsx`, `src/messages/en.ts`, `tests/panel-rows.test.ts`, `tests/jobs-panel.test.tsx`,
`tests/next.test.ts`, `README.md`, `CHANGELOG.md`, manifest `tables`.

- `QueueStats.pause` (`{ source, reason, until } | null`, only while active) and `consecutiveFailures`.
- Panel: a paused line (reason, until or "until resumed") and **Pause** / **Resume** per queue through optional
  `pauseQueue` / `resumeQueue` actions; the page passes both.
- README "Pacing and the circuit breaker", Limitations updated, CHANGELOG `Unreleased` with the migration.

## Decisions (auto)

- Fixed window for `{ max, perSeconds }`: simple, one row, the budget an unwritten limit usually means.
- The breaker counts retries and attempt-exhausting failures; `failJob` and invalid payloads are the job's own fault.
- A failure with a code outside `codes` neither counts nor resets: only a success resets.
- `pauseQueueLater` gives the attempt back (issue ask 6: a refusal is not the job's failure); a poison job is still
  bounded by the breaker's alert and the operator.
- Operator pauses run no hook: the operator already knows. Panel Pause has no end and the reason `jobs.operator_pause`.
- No version bump: the coordinator releases the batch.

## Progress

- [x] Phase 1: state, options, pacing and pauses in the claim
- [x] Phase 2: the breaker, `pauseQueueLater` and `onQueuePaused`
- [x] Phase 3: stats, admin page and docs
- [x] Implementation review (`runDueJobs` keeps its report shape)

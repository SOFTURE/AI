# Plan: jobs-scheduled-tick

## Approach

One tick function, `runJobsTick`, in `@softure-ai/jobs/server`: enqueue due schedules, check schedule health, claim and
run due jobs (each queue up to its concurrency, every job under its lease heartbeat) until nothing is due or the time
budget ends, wait for what still runs (reporting each job that outlives the budget), prune once an hour and write a
heartbeat row. A new `@softure-ai/jobs/workers` entry wraps it in `createScheduledHandler` for a Cron Trigger: it opens
the request database on the Hyperdrive URL from `env` and hands the tick to `waitUntil`. The Node loop keeps its
continuous shape and shares the round's steps with the tick (schedules, schedule check, prune, leased job run), so both
paths run the same code.

## Decisions (auto)

- The Node loop shares the tick's steps instead of calling `runJobsTick` in a loop: the loop's continuous claiming,
  wake-up on a finished job and graceful stop are what Node users rely on ("Node worker behaviour unchanged"); the tick
  is one bounded round of the same steps. Roadmap Outcome reworded at archive.
- The budget limits claiming, not running: a job still running at the budget is logged as `warn` with its id and keeps
  its lease until it ends; if the platform stops the invocation, the lease expires and the next claim records
  `jobs.lease_expired`. Releasing it instead would hand back the attempt and rerun it forever.
- Default budget 45 s, so a tick fired every minute mostly ends before the next one; overlaps stay safe.
- Health on Workers: table `jobs.worker_heartbeats (worker_id, beat_at, pruned_at)`; the tick upserts its row after a
  round whose claims reached the database; `checkJobsTickHealth` reads it. `pruned_at` makes hourly pruning a
  conditional update, so overlapping ticks prune once.
- The tick logs database failures at once as `error` (tolerance 0): a tick has no outage to wait out.
- `worker/database-outage.ts` moves to `server/` so the tick can use it without the Node worker entry.

## Phases

### Phase 1: shared steps and `runJobsTick` (TDD)
- `server/database-outage.ts` (moved), `server/leased-run.ts` (start a claimed job with its lease heartbeat),
  `server/round.ts` (schedules, schedule check, prune), `server/tick.ts` (`runJobsTick`, `checkJobsTickHealth`).
- Migration `0010_create_worker_heartbeats.sql`, schema, manifest tables.
- Node loop uses the shared steps; `server/admin.ts` and `next/context.ts` import `@softure-ai/db/request`.
- Tests `tests/tick.test.ts`: runs due jobs up to concurrency, enqueues a schedule once across two overlapping ticks,
  reports a job past the budget and still records it, prunes once an hour across ticks, writes and checks the
  heartbeat, stops at nothing due.
- Done when: `npm test -- modules/jobs` green, existing worker tests unchanged.

### Phase 2: `./workers` entry and declarations (test-after)
- `src/workers/scheduled.ts`, `src/workers/index.ts`, export `./workers` in package.json; declare jobs
  `[".", "./server", "./workers", "./next", "./ui", "./react"]`; every module `./jobs`, alerts `./server`, `./next`,
  blog `./server`; `workers` in alerts and blog `runtimes`; version bumps, CHANGELOGs, lockfile.
- Test `tests/workers.test.ts`: the handler opens the request scope on the URL from `env`, hands the tick to
  `waitUntil`, names the run by `scheduledTime`, and rejects (logged) on a config without a handler.
- Guard expectations in `tests/repo/workers-entries.test.ts` if any; docs (`docs/07-runtime-providers.md`, jobs
  README).
- Done when: full `npm test`, typecheck, lint green.

## Progress

- [x] Phase 1: shared steps and `runJobsTick` (tests/tick.test.ts 7 passed; jobs suite 355 passed)
- [ ] Phase 2: `./workers` entry and declarations

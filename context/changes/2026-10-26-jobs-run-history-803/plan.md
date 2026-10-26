# Plan: jobs run history (issue #803)

## Phase 1: origin, summary and the runs table

Files: `modules/jobs/migrations/0006_create_runs.sql` (new), `src/schema.ts`, `src/contract.ts`, `src/summary.ts`
(new), `src/handlers.ts`, `src/index.ts`, `module.json`, `src/server/enqueue.ts`, `src/server/schedules.ts`,
`src/server/job-row.ts`, `src/server/claim.ts`, `src/server/process.ts`, `tests/runs.test.ts` (new).

1. Tests first (`tests/runs.test.ts`): origin `app` by default, `schedule` from the schedule tick, `manual` from
   `runScheduleNow`, an override on both, a `RangeError` for an invalid origin; a run row per succeeded, retried and
   failed attempt with origin, attempt, error code, start and finish; the summary of `ok({ summary })` stored; an
   invalid summary still succeeds, stores none and warns with paths only; a lease lost with no attempts left records
   a failed run with no start; `retryJob` keeps the origin.
2. Migration 0006: `jobs.jobs.origin text NOT NULL DEFAULT 'app'` with the queue-name pattern; `jobs.runs` (identity
   id, `job_id`, `queue`, `origin`, `attempt`, `outcome` in succeeded/retried/failed, `error_code`, `summary jsonb`,
   `started_at` nullable, `finished_at`), checks tying `error_code` and `summary` to the outcome, indexes on
   `finished_at` and `(queue, finished_at)`. No foreign key: runs outlive pruned jobs.
3. `summary.ts`: `jobRunSummarySchema` (strict): `code?` (code pattern), `items?` `{ new?, skipped?, failed? }`
   non-negative integers, `steps?` record of step name → `done` | `skipped` | `failed` (at most 50).
4. `enqueueJob` takes `origin`; the schedule tick passes `schedule`; `runScheduleNow(ctx, queue, { origin })` defaults
   to `manual`. `Job.origin`.
5. `completeJob` inserts the run row in its transaction (succeeded carries the summary); `failExhaustedLeases` inserts
   failed rows for the jobs it fails. `process.ts` reads the summary from the `ok` value.

## Phase 2: retention and reads

Files: `src/options.ts`, `src/server/maintenance.ts`, `src/server/runs.ts` (new), `src/server/index.ts`,
`src/worker/run-job-worker.ts`, `tests/runs.test.ts`, `tests/worker.test.ts` if needed.

1. Tests: `pruneJobRuns` deletes runs past `retention.runsDays` (30) whatever `succeededDays` is; the worker prunes
   them hourly; `listJobRuns` newest first, filters by queue, origin and outcome, limit 1–500.
2. `retention.runsDays` default 30; `pruneJobRuns(ctx)` batched like `pruneJobs`; the worker calls it with the others.
3. `listJobRuns(ctx, input)` returning `JobRun`.

## Phase 3: the admin page

Files: `src/messages/en.ts`, `src/next/panel-rows.ts`, `src/next/pages.tsx`, `src/ui/jobs-panel.tsx`, `src/ui/index.ts`,
`tests/panel-rows.test.ts`, `tests/jobs-panel.test.tsx`, `tests/next.test.ts`.

1. Tests: the panel renders a Recent runs section only when `runs` is passed; rows show origin, attempt, outcome,
   item counts, code, steps and the error code, never a payload; the page shows a run after `runDueJobs`.
2. `JobsPanelRun`, optional `runs` prop; `toJobsPanelData` maps optional `runs`; the page reads the last 50 runs.
   Copy in `messages.runs`; origin labels for the built-in origins, the raw code for an app's own.

## Phase 4: docs

Files: `modules/jobs/README.md`, `modules/jobs/CHANGELOG.md`.

README: handler summary, origin, run history and its retention, `listJobRuns`, `pruneJobRuns`, migration 0006, the
table list. CHANGELOG `## Unreleased` with the migration step for apps (run 0006; drop an own run table; a full own
dictionary adds `runs`).

## Decisions (auto)

- A `jobs.runs` table per recorded attempt, not columns on `jobs.jobs` (research, option 2).
- Built-in origins `app` (default of `enqueueJob`), `schedule`, `manual` (default of `runScheduleNow`); any value
  matching the queue-name pattern is allowed.
- Summary fields fixed by a strict schema (code, item counts, step outcomes): codes and counts only. An invalid summary
  never fails a job that did its work; it is dropped with a warning.
- A failed attempt has no summary; its error code is the run's code.
- `retention.runsDays` default 30, the issue's "last 30 days".
- The panel's runs section appears only when `runs` is passed, so apps composing `JobsPanel` see no empty section.

## Progress

- [ ] Phase 1: origin, summary and the runs table
- [ ] Phase 2: retention and reads
- [ ] Phase 3: the admin page
- [ ] Phase 4: docs

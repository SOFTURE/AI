# Plan: jobs-schedules

Input: change.md, research.md (framing skipped, reason in change.md). Complexity: medium (three phases).

## Goal

`jobs({ schedules: { "<queue>": { every: "1h" } } })` makes every worker (and `runDueJobs`) enqueue each due run once;
`getQueueStats` reports a late schedule; auth, mcp-access, waitlist, security and analytics export job handlers and
schedules for their prune functions from a `./jobs` subpath; READMEs and CHANGELOGs carry the recipe and migration.

**Out of scope:** billing (#490); cron expressions (see Decisions); a release.

## Approach

Chosen: a `jobs.schedules` row per schedule holding the last enqueued slot; slots are aligned to the Unix epoch, so
every worker computes the same slot; the worker claims a slot with a conditional upsert and enqueues its job in the
same transaction. Rejected: a dedup key per slot alone (a finished job frees its key, so a late worker re-enqueues);
an advisory lock (does not persist the last slot, so a restart re-runs it).

## Phase 1: Schedules in jobs

**Discipline:** TDD. **Files:** `modules/jobs/{migrations/0002_create_schedules.sql,module.json,src/index.ts,
src/options.ts,src/schema.ts,src/server/{schedules,maintenance,claim,run-due,index}.ts,src/worker/run-job-worker.ts,
tests/schedules.test.ts}`.

- Options: `schedules: Record<queue, { every: "<n>m|h|d", payload? }>`; a schedule's queue gets default queue options
  unless `queues` names it; at least one queue or schedule.
- `enqueueDueSchedules(ctx, { queues? })`: per schedule, the current slot; conditional upsert of `last_slot_at`; on a
  win, `enqueueJob` with the dedup key `schedule` in the same transaction.
- A succeeded job of a scheduled queue sets `last_succeeded_at`.
- `getQueueStats` gains `schedule: { everySeconds, lastEnqueuedAt, lastSucceededAt, isLate } | null`; late when no
  success (or first sight) within two periods.
- Worker: enqueues due schedules of its queues once per slot (in-memory last slot), before claiming; `runDueJobs`
  enqueues them first.

Done when: tests cover once per slot across two runners, catch-up collapses to the latest slot, coalescing with a live
run, success recording, lateness, option validation, worker and `runDueJobs` paths.

## Phase 2: Package handlers

**Discipline:** TDD. **Files:** per package `src/jobs/index.ts`, `package.json` (`./jobs` export, optional peer),
`module.json` + inline manifest (`jobs: "^0.1.0?"`), `tests/jobs.test.ts`.

- auth: `auth.prune-sessions` (hourly), `auth.prune-password-resets` (daily). mcp-access: `mcp-access.prune` (daily).
  waitlist: `waitlist.prune-unconfirmed-signups` (hourly). security: `security.prune-rate-limits` (hourly).
  analytics: `analytics.prune-funnel-counts` (daily, payload `{ keepDays }`, schedules from a function).
- Each exports `<pkg>JobHandlers` and `<pkg>JobSchedules` (analytics: `createAnalyticsJobSchedules({ keepDays })`).

Done when: each handler test shows the prune ran through the handler and the schedules parse with `jobsOptionsSchema`.

## Phase 3: Docs and gates

**Discipline:** test-after. **Files:** READMEs and CHANGELOGs of the six packages.

Done when: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` green.

## Risks and rollback

- jobs is unreleased, so its new migration ships with its first version. The other packages only gain a subpath and
  an optional peer; apps that ignore it see no change. Rollback: revert the merge.
- A dependent's release needs jobs 0.1.0 first (release-rules range check).

## Decisions (auto)

- `every` only (`<n>m`, `<n>h`, `<n>d`, one minute to seven days), aligned to the epoch in UTC; no cron expressions
  yet (the issue offers either; one is the simplest that covers the prune jobs and billing).
- Scheduled runs share the dedup key `schedule`: while a run is still pending or running, the next slot coalesces into
  it instead of piling up behind a failing handler.
- Missed slots collapse into one run at the latest slot.
- Lateness lives in `getQueueStats`, not in the module health check: a late prune must not make the app unready.
- Handlers live in a `./jobs` subpath so apps without jobs never load it.
- Peers take `@softure-ai/jobs` as `^0.1.0 || 0.0.0` and `dependsOn` as `jobs: "*?"`: jobs is still the unreleased
  workspace `0.0.0`, which `^0.1.0` alone cannot install (impl review). jobs releases before or with the five
  packages.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Schedules in jobs

#### Automated
- [x] 1.1 Schedule, worker and stats tests pass — fa369a9
- [x] 1.2 Gates green (typecheck, lint, test) — fa369a9

### Phase 2: Package handlers

#### Automated
- [x] 2.1 Handler tests pass in the five packages — be63ecd
- [x] 2.2 Gates green (typecheck, lint, test) — be63ecd

### Phase 3: Docs and gates

#### Automated
- [x] 3.1 READMEs and CHANGELOGs updated — fd2f5a8
- [x] 3.2 Gates green (typecheck, lint, test, build) — fd2f5a8

---
change_id: jobs-schedules
---

# Research: recurring schedules in jobs (issue #491)

## Current state (master 3b765d4)

- `@softure-ai/jobs` (0.0.0, unreleased, `## Unreleased` in its CHANGELOG): one table `jobs.jobs`, `enqueueJob` with a
  `dedupKey` that only covers live (pending, running) jobs, so a dedup key alone cannot make "one run per slot": a
  slot whose job already succeeded would be enqueued again by a late worker. A per-schedule row with a conditional
  upsert is needed.
- The worker loop (`src/worker/run-job-worker.ts`) polls every `pollIntervalMs` and prunes hourly with an in-memory
  timestamp; `runDueJobs` (`src/server/run-due.ts`) is the same path without the loop, for tests and cron apps.
- `completeJob` (`src/server/claim.ts`) records the outcome with a fenced update; `getQueueStats`
  (`src/server/maintenance.ts`) counts per queue and status.
- Options (`src/options.ts`): `queues` record with a name regex and "at least one queue", `pollIntervalMs`,
  `shutdownGraceMs`, `retention`. `getQueue` throws on an unknown queue.
- Prune functions: all take `ModuleContext<Queryable>` (`{ db, clock, config }`), which a job handler's context
  satisfies structurally. `pruneFunnelCounts` also takes `{ keepDays }`; `pruneRateLimits` returns void,
  `pruneMcpAccess` an object, the rest a count.
- Optional integration pattern: auth's `./mailing` subpath with `@softure-ai/mailing` as an optional peer, and
  `"mailing": "^0.2.0?"` in `dependsOn` (module.json and the inline manifest). `tests/repo/packages.test.ts` requires
  every peer module to be named in `dependsOn`.
- `defineSoftureConfig` checks optional `dependsOn` ranges when both modules are listed, so a package test that enables
  jobs 0.0.0 next to a module with `jobs: "^0.1.0?"` would fail until jobs is released; handler tests run the handler
  directly instead. `release:version` accepts bumping jobs to 0.1.0 under that range; `release:pack` of a dependent
  refuses while jobs is still 0.0.0, so jobs releases first or in the same batch.
- Postgres `INSERT … ON CONFLICT DO UPDATE … WHERE` locks the row and re-checks the condition after a concurrent
  writer commits, so exactly one worker wins a slot; drizzle exposes it as `onConflictDoUpdate({ setWhere })`.

---
change_id: jobs-run-now-follow-up
title: "jobs 0.1.15: run now queues a follow-up run while a run of the schedule is running (issue #1454)"
status: in_progress
roadmap_item: null
issue: 1454
branch: claude/project-thread-5y02ob
created: 2026-11-24
updated: 2026-11-24
---

## Intent
A "run now" pressed while a run of the schedule is in progress queues one follow-up run, so input added after the
current run read its list is read right after it, not a period later. Issue #1454 (`bug`, `pkg: jobs`, `adoption`).

## Context
`runScheduleNow` enqueues with the schedule's dedup key `schedule`, and `enqueueJob` treats a pending or running job
with that key as a duplicate. The partial unique index `jobs_dedup_key_idx` (queue, dedup_key) over live jobs allows
only one live job per key, so a pending run behind a running one needs a second key.

## Scope
- `runScheduleNow`: joins a pending run of the schedule; when only a running one is live, queues a new pending run.
  At most one running plus one pending per schedule.
- The schedule tick keeps joining any live run (pending or running) of the schedule.
- Tests, README, CHANGELOG, version 0.1.15.
- Out of scope: changing the adopting app (its test workaround is described in the CHANGELOG).

## Decisions (auto)
- Two alternating dedup keys, `schedule` and `schedule.next` (`SCHEDULE_DEDUP_KEYS`): a follow-up takes the key the
  running run does not hold. No migration, the unique index keeps two live runs with one key impossible.
- No `joinRunning` option on `enqueueJob`: the index would refuse a second live job with the same key anyway, and the
  rule belongs to schedules.
- The tick enqueues only when no run of either key is live, so a pending follow-up absorbs the next period as before.
- When two runs of the schedule are already running (two workers), run now joins the later one: no third live run.
- Patch 0.1.15: ten packages depend on jobs with `^0.1.x`, a minor would break their ranges.

## Notes
- frame skipped: the problem is a reported, reproduced gap with one proposed shape.

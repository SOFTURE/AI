---
change_id: jobs-schedule-last-failure-603
title: "jobs: getQueueStats reports a scheduled queue's last failure (issue #603)"
status: in_progress
roadmap_item: null
issue: 603
branch: claude/project-thread-plc486
created: 2026-10-19
updated: 2026-10-19
---

## Intent

Close [issue #603](https://github.com/SOFTURE/AI/issues/603) (labels `enhancement`, `pkg: jobs`): an adopting app
shows how fresh an hourly sync is and needs to know whether the latest run failed after the last success. Today it
keeps a read log of its own only for that. `getQueueStats` should report, per scheduled queue, `lastFailedAt`,
`lastFailureCode` and a documented "failing" rule (`lastFailedAt > lastSucceededAt`).

## Context

jobs 0.1.2 is the latest on npm and on master. Releases are batched by the coordinator: no version bump here, the
CHANGELOG gets `## Unreleased`. The app migrates itself; the CHANGELOG and the issue comment describe the steps.

## Constraints

- Additive: existing `ScheduleState` fields and their meaning stay.
- The failure is recorded in the same transaction as the job's terminal state, like a success.
- Only the stable error code is stored, never an error's text (the module already stores codes only).

## Notes

- Framing: skipped. The issue names the gap, the fields and the acceptance tests.

## Decisions (auto)

- Record terminal failures only (a job that ends `failed`: retries used up, `failJob`, invalid payload, expired lease
  with no attempts left), not each retried attempt: a run that recovers on its second attempt is not a failure the
  app should show. Matches the issue's first option ("the latest job that ended `failed`").
- Add `isFailing: boolean` to `ScheduleState` next to the documented rule, so an app does not re-implement it.
- Store the two fields in `jobs.schedules` (migration `0003`), not computed from `jobs.jobs`: finished jobs are pruned
  after their retention, the schedule row is not.

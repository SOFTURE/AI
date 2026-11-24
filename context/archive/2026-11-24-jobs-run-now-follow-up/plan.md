# Plan: jobs-run-now-follow-up

## Approach
In `schedules.ts`, read the live runs of the schedule under both keys. `runScheduleNow` joins a pending one, else
enqueues under the key no running run holds (re-reading on a lost race). The tick enqueues only when nothing is live.

## Phases
### Phase 1: follow-up run (TDD)
- Tests first (red) in `tests/steering.test.ts`: run now while a run is running queues one pending run
  (`isDuplicate: false`, key `schedule.next`); a second call joins it; after the first run ends and the follow-up runs,
  run now queues again under `schedule`; with no live run the behaviour is unchanged. In `tests/schedules.test.ts`:
  the tick joins a pending follow-up instead of queueing a third run.
- `src/server/schedules.ts`: `SCHEDULE_FOLLOW_UP_DEDUP_KEY`, `SCHEDULE_DEDUP_KEYS`, `findLiveScheduleRuns`,
  the new `runScheduleNow` and the tick check; export from `src/server/index.ts`.
- README (schedules section, API table), CHANGELOG 0.1.15, version via `npm run release:version`.
- Done when: `npx vitest run modules/jobs` passes, typecheck and lint pass.

## Progress
- [x] Phase 1: follow-up run (four new tests red before the change; after: `npx vitest run modules/jobs` 25 files,
  389 tests passed; typecheck and lint pass) 3f76af7; version 0.1.15 98c0b7c

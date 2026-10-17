---
change_id: jobs-local-time-schedules-554
---

# Research: local-time schedules (issue #554)

## Current code

- `modules/jobs/src/options.ts`: `scheduleSchema` is `{ every, payload }`; `parseEverySeconds` checks `every`.
- `modules/jobs/src/server/schedules.ts`: `getScheduleSlot(schedule, now)` floors `now` to a multiple of the period;
  `enqueueScheduledRun` takes the slot with a conditional upsert (`last_slot_at < slot`) and enqueues the run in the
  same transaction; `getScheduleStates` derives `isLate` from `everySeconds`.
- `modules/jobs/src/worker/run-job-worker.ts` and `enqueueDueSchedules` only call `getScheduleSlot` and
  `enqueueScheduledRun`, so a slot function for `at` schedules is all they need: the "once per slot" guarantee lives
  in the upsert and only needs slots that increase over time.
- Packages that ship schedules (auth, mcp-access, waitlist, billing, security, analytics) write `{ every }` and use
  `JobSchedulesInput`; a union keeps them valid.

## Time zones without a library

`Intl.DateTimeFormat(…, { timeZone, hourCycle: "h23", … }).formatToParts(instant)` gives the wall-clock time of an
instant in a zone; the offset is that wall clock read as UTC minus the instant. A local date and time maps to an
instant by trying the zone's offsets twelve hours before and after (one DST change per day at most) and keeping the
candidates that map back; none maps back inside a DST gap. `new Intl.DateTimeFormat("en", { timeZone })` throws a
`RangeError` on an unknown zone, which serves as the validation at startup. Node 22 ships full ICU.

## The slot of an `at` schedule

The latest occurrence of any listed time at or before `now`, looked for on the local date of `now` and the day
before. Distinct local times give distinct, increasing instants, so the existing upsert keeps one run per slot.

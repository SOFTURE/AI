# Implementation review: testing-core-test-time-zone

Reviewed: the branch diff against plan.md (Phases 1 and 2), change.md and issue #251.

Verdict: **ready to merge** (no open blocking findings).

## Evidence

- Red runs before the code: `tests/time-zone.test.ts` and the new `vitest-setup` tests failed on the missing exports
  (14 of 17); `tests/calendar-day.test.ts` failed 7 of 7 (`toCalendarDay is not a function`).
- Green runs: testing tests 47 passed (browser tests skip without Chromium here, as on master), repeated with three
  random seeds and once under `TEST_TZ=Europe/Warsaw`; core calendar-day tests 7 passed. Gates typecheck, lint (with
  the language gate), build and the full `npm test` green before the push.
- The worker-thread case is proven, not assumed: a test runs `pinTimeZone` in a real `worker_threads` worker and
  gets the documented error, and a second one shows it passes there when the process already runs in the zone.
- The setup order is proven: with the process in Tokyo, `TEST_TODAY=2027-01-02` lands on 2 January in New York only
  because the zone is pinned before the shift.

## Findings

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | The setup's default pin is a behaviour change for apps that already list the setup file: their tests leave the machine's zone. That is the guard the issue asks for; the CHANGELOG says so and `TEST_TZ` or `pinTestTimeZone(zone)` keeps another zone. | No change: documented. |
| 2 | Suggestion | `toCalendarDay` caches one formatter per zone name without a bound. Apps pass a handful of configured zones; an unbounded set of names would come only from user input, which should be validated first. | No change. |
| 3 | Check | Drift from plan: none. Exports, README sections, CHANGELOG lines (testing 0.1.3, core Unreleased) match D1-D4. | No change. |
| 4 | Check | Language gate and neutral wording: no app or person named in code, docs or change files. | No change. |

## Follow-up

The modules' own day helpers (blog `getDayInZone` and quality settings, privacy route, mcp-access token status,
billing day numbers) can move onto `toCalendarDay` once core with it is published; filed as #270.

## Release

Not released by this change. `@softure-ai/testing` 0.1.3 now carries #245 and #251; `@softure-ai/core` has the
entry under `## Unreleased` (npm has 0.1.6).

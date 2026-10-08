# Plan review: modules-core-calendar-day

Reviewed: `plan.md` against `change.md`, issue #270, PR #272 (`foundation/core/src/calendar-day.ts`), the five
files the issue names, their tests, `tests/repo/release-rules.test.ts`, `scripts/release/README.md`, the versions
on npm and the example app's manifests.

Verdict: **approve with fixes applied** (one finding accepted into the plan, two recorded).

## Findings

### F1 (Warning, low effort): the privacy file name has no test seam — accepted
`getFileName` is private in `src/next/route.ts`, and testing it through `exportRoute` needs a session and a
database. **Decision:** export `getFileName` from `route.ts` (the `/next` index re-exports only `exportRoute`, so
the public surface does not grow) and test it directly; D4 now reads that way.

### F2 (Suggestion): release order — recorded
The four modules will require `@softure-ai/core` `^0.1.7`. If a module is published before core 0.1.7 is on npm,
installing it fails until core follows. **Decision:** after the merge, release core first and the modules only
once core's release has passed. No plan change (release is after the merge).

### F3 (Suggestion): the example app's lockfile — checked, no change
`examples/next-app` links the packages with `file:` and its lockfile has not followed earlier version bumps
(`git log` of that file); `npm ci` there resolves the links. **Decision:** no change needed.

## Checks that passed

- `^0.1.0` ranges elsewhere (every other module) accept core 0.1.7, so only the four touched modules change range.
- `toCalendarDay` throws `RangeError` on an invalid date, as `Intl.DateTimeFormat#format`/`formatToParts` already
  did in every copy, so error behaviour is unchanged.
- billing `getStartOfDay` keeps the wall-time path; switching its formatter's locale to `en-US` is safe because it
  reads `formatToParts` by type, with `hourCycle: "h23"` (midnight is `00`, never `24`). The DST and
  midnight-skipping tests in `tests/calendar.test.ts` cover it.
- The day-number conversion (`Date.parse("YYYY-MM-DDT00:00:00Z") / DAY_MS`) is an integer for every day, equal to
  the old `Date.UTC(y, m - 1, d) / DAY_MS`.
- blog 0.1.9 is on npm, so blog needs 0.1.10; privacy, mcp-access and billing 0.1.9 are not, so they take entries
  in 0.1.9.

# Plan: modules-core-calendar-day

Input: change.md (research and framing skipped; reasons there). Complexity: small (one phase, five packages,
mechanical).

## Goal

blog, privacy, mcp-access and billing compute calendar days through `toCalendarDay` from `@softure-ai/core`
(`^0.1.7`); no `en-CA` formatter remains; core is 0.1.7; tests, changelogs and versions follow.

**Out of scope:** billing's `getStartOfDay` wall-time arithmetic (needs hours, not a day); apps' own copies;
`getCalendarDay` call sites (no module reads "today" from a clock in these files except blog's CLI and gate, which
pass `clock.now()` to `getLocalDate` and stay as they are).

## Findings (the reading behind the plan)

- blog `src/pages/dates.ts`: `getDayInZone(moment, timezone)` (exported from `/pages`), used by `getArticleDates`.
  `src/quality/settings.ts`: `getLocalDate(moment, timeZone)` (exported from `/quality`), used by the gate and the
  CLI for `today`. Both are the same `en-CA` one-liner.
- privacy `src/next/route.ts`: `getFileName` builds `<fileName>-YYYY-MM-DD.json` with an `en-CA` formatter.
- mcp-access `src/token-status.ts`: private `getDayNumber` builds a new `en-CA` formatter per call and reads
  `formatToParts` into `Date.UTC(...) / DAY_MS`. Tests: `tests/token-status.test.ts`.
- billing `src/calendar.ts`: `getDayNumber` floors the local wall time (an `en-CA` `formatToParts` with hours,
  `hourCycle: "h23"`) to days; `getStartOfDay` needs the wall time with hours. `parseDay` turns `YYYY-MM-DD` into
  the same day number. Tests: `tests/calendar.test.ts` (DST zones, midnight-skipping zones).
- All four depend on `@softure-ai/core` `^0.1.0`; `tests/repo/release-rules.test.ts` and `release:pack` refuse a
  range the workspace version does not satisfy.

## Key decisions

- **D1 Keep the public blog names, delegate.** `getDayInZone` and `getLocalDate` stay exported with the same
  signature and become one-line calls of `toCalendarDay`; their doc comments point to core. Removing them would be
  a breaking change for no gain.
- **D2 Day numbers from the day string.** mcp-access and billing turn `toCalendarDay(...)` into a day number with
  `Date.parse(\`${day}T00:00:00Z\`) / DAY_MS` (exact: midnight UTC is a whole multiple of a day). billing keeps
  `getLocalWallTime` for `getStartOfDay` only, with its formatter on `en-US` (`formatToParts`, so no pattern is
  read) to leave no `en-CA` behind.
- **D3 Versions.** core 0.1.6 → 0.1.7 (its `## Unreleased` from #251 becomes `## 0.1.7`); blog 0.1.9 → 0.1.10
  (0.1.9 is on npm); privacy, mcp-access and billing get entries in their unreleased 0.1.9. Ranges `^0.1.7`;
  lockfile regenerated with `npm install`.
- **D4 Tests.** Existing tests pin the results (billing, mcp-access). Add: blog `getDayInZone`/`getLocalDate`
  equal `toCalendarDay` across a zone boundary (an evening in New York is the next day in UTC); privacy
  `getFileName` (exported from `route.ts` for the test, plan review F1) gives the day in the app's zone. Each new
  test is checked to fail against a deliberately wrong zone before it counts. This is a refactor with no observable
  bug today, so there is no red-first regression test.
- **D5 Wait for #272.** Implementation starts once `toCalendarDay` is on master; the branch then merges master.

## Phase 1: move the modules onto core

- Code: the five files above; `package.json` ranges of the four modules; core and blog versions (blog
  `module.json` and the manifest in `src/index.ts` too); lockfile.
- Tests: D4.
- Docs: CHANGELOG entries in the four modules and core's 0.1.7 heading.

Done when: `grep -rn "en-CA" modules foundation --include=*.ts` is empty; gates green (typecheck, lint, test,
build).

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: move the modules onto core

#### Automated
- [ ] 1.1 #272 merged and master merged into the branch
- [ ] 1.2 blog, privacy, mcp-access and billing call toCalendarDay; no en-CA left
- [ ] 1.3 New tests seen failing on a wrong zone, then green
- [ ] 1.4 Ranges ^0.1.7, core 0.1.7, blog 0.1.10, changelogs, lockfile
- [ ] 1.5 Gates green (typecheck, lint, test, build)

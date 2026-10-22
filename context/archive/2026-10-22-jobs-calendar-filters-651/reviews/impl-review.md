---
change_id: jobs-calendar-filters-651
reviewed: 2026-10-22
verdict: approved
---

# Implementation review: jobs-calendar-filters-651

Checked the diff (49ecdfd, 4eadbf1) against change.md, plan.md and issue #651.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | Acceptance 1: slot tests cover weekdays (Saturday and early Monday fall back to Friday 20:00), the 10th, `"last"` in 30/31-day months and February (2026 and leap 2028), `31` skipping April, both filters together, and the local date in Warsaw differing from the UTC date. `enqueues a filtered schedule only on the dates it matches` drives four days of ticks and gets Friday, Monday, Tuesday only. | Met. |
| 2 | Check | Acceptance 2: module tests refuse empty lists, 0, 8, 1.5, duplicates, 0, 32, `"first"`, a repeated `"last"`, and either filter on `every`; filters parse sorted. | Met. |
| 3 | Check | Acceptance 3: a weekday hourly schedule after a Friday 20:00 success reports `everySeconds` 60h on Saturday, is not late on Monday 09:00 and is late a millisecond later; a success clears it. | Met. |
| 4 | Check | Monotonic slots: a minute-by-minute walk over Friday to Wednesday with the weekday filter never moves back or past `now`, which the worker's settled-slot cache and the `last_slot_at < slot` upsert rely on. | No change. |
| 5 | Minor | Unfiltered `at` schedules with uneven times now report the current gap and a stricter `isLate`; one existing test moved from 14h to 8h/14h. | Intended (change.md Decisions); the CHANGELOG names it. |
| 6 | Check | Cost per worker poll: the date walk is `Date.UTC` arithmetic; `getZonedInstant` runs only on matching dates. The worst case (608 days back) is tested and stays within the 800-date bound. | No change. |
| 7 | Check | No Polish, no new dependency, no migration; `DayOfMonth` exported from `@softure-ai/jobs`. | No change. |

Gates: `npm run typecheck`, ESLint and the language gate green in pre-commit; jobs tests 167 passed.

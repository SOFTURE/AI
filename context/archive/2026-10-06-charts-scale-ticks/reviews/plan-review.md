# Plan review: charts-scale-ticks

Date: 2026-10-06 · Verdict: approved with fixes applied

Checked against change.md, research.md, FIRE_TRACKER `src/lib/{chart-scale,chart-ticks,nearest-point}.ts` and their
tests, `templates/package/`, `foundation/testing/` (the private-until-publish precedent), `tests/repo/packages.test.ts`
and the lessons on hand-written oracles (L-053) and unseen-green tests.

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Warning | `dateTicks` had no defined result for an empty span or a target below 1; an empty `ticks` array still needs a `unit`, which would be invented. | Fixed: returns `null` there; both cases in the Phase 2 test list. |
| 2 | Warning | Generating ticks for every (unit, step) candidate builds tens of thousands of day ticks for a long span before rejecting them. | Fixed: "Bounded candidates" in Key decisions; a 100-year case in Phase 2. |
| 3 | Warning | FIRE's tests are written in Polish; ported as they are, they fail the language gate. | Fixed: "Ported tests are translated to English" in Key decisions. |
| 4 | Suggestion | Weekly ticks on Monday differ from the US convention (Sunday). | Accepted as a documented limitation; a locale-driven week start can come with CH-2 if an axis needs it. |
| 5 | Suggestion | An invalid IANA zone makes `Intl` throw. The conventions return expected failures as values, but a bad zone is a bug (core validates `config.timezone` at startup). | Accepted: the `RangeError` propagates; written in Key decisions. |
| 6 | Suggestion | `timeScale` with `start === end` must not divide by zero. | Already covered by the zero-width domain rule shared with `linearScale`. |

No migration, no copy, no public package changed. The package stays private, so `auto-release all` skips it until
CH-5. Every criterion is checkable in the container.

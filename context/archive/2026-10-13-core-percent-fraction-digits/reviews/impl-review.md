# Implementation review: core-percent-fraction-digits

Reviewed: the branch diff against plan.md, change.md and issue #455.
Verdict: **approve**.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | Drift from plan: none. One option in `format.ts`, one test file, README and CHANGELOG. | No change. |
| 2 | Check | Without `fractionDigits` the formatter gets the same options as before (`maximumFractionDigits: 2`), so the cache key and every existing output are unchanged; `format.test.ts` and `core-formatters-410.test.ts` pass untouched. | No change. |
| 3 | Check | The zero rule at a fixed precision (`0.0%`, signed or not, for `-0.4`, `0.4` and `-0`) is pinned by tests. | No change. |
| 4 | Check | Invalid digit counts (`-1`, `1.5`, `21`, `NaN`, `Infinity`) throw a `RangeError` naming the value, before `Intl` sees them. | No change. |
| 5 | Check | No copy added; nothing non-English in the diff. | No change. |

Gates: see plan.md Progress.

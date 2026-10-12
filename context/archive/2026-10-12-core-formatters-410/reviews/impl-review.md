# Implementation review: core-formatters-410

Reviewed: the branch diff against plan.md, change.md and issue #410.
Verdict: **approve**.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | Drift from plan: none. Six additive helpers in core, one test file, docs. | No change. |
| 2 | Check | The only changed existing behaviour is `formatPercent` showing `0%` instead of `-0%` for a value that rounds to zero, as change.md's constraint allows; `config.test.ts` now expects the always-filled `landingOrigin`. | No change. |
| 3 | Check | Duration copy is in `messages/{en,pl}.ts` with every plural key pl needs; the pl dictionary keeps en's shape (`typeof en`). | No change. |
| 4 | Check | `memoizeByContent` keys are exact serializations with type tags, so `1`/`"1"`, `null`/`undefined` and `0`/`-0` stay apart (tested); a cycle or an unsupported value throws by name; a rejected promise is removed only if it is still the cached entry. | No change. |
| 5 | Check | `memoize.ts` and `format.ts` import nothing from `node:`, so the main entry stays browser-safe. | No change. |
| 6 | Check | Test strings with Polish letters use `\u` escapes; `lint:language` passes. | No change. |

Gates: see plan.md Progress.

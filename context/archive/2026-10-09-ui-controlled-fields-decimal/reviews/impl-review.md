# Implementation review: ui-controlled-fields-decimal

Reviewed: the branch diff against plan.md, change.md and issue #320.
Verdict: **approve**.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | Drift from plan: none. `amount.ts` gains `parseDecimal`, `formatDecimal`, `normalizeDecimalInput`, `DecimalErrorCode`, `DecimalScale`, `DecimalFormatOptions`; the amount functions delegate at scale 2. | No change. |
| 2 | Check | Tests: 17 of 18 new tests red on master, all green after; `amount.test.ts` and `form-fields.test.tsx` unchanged and green (ui: 477 tests). | No change. |
| 3 | Check | Controlled input always has `onChange` (the union requires `onValueChange` with `value`), so React never warns about a read-only controlled input. | No change. |
| 4 | Check | Docs: README export table and Forms section with an example; CHANGELOG under the unreleased 0.1.15 (version already bumped on master). | No change. |

Gates: see plan.md Progress.

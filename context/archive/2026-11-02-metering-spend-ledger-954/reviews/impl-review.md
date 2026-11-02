---
change_id: metering-spend-ledger-954
verdict: approved
---

# Implementation review

Reviewed the diff of 9673780, ac2e725 and c993ed8 against plan.md and the issue.

- Ask 1 (table): `metering.charges` with checks on every column, the reserved/expires and settled/settled_at pairs
  enforced by the table (`module.test.ts`, ten refusals).
- Ask 2 (budgets): per provider and `day` or `month`, provider-wide or per account; duplicates refused at startup.
  Periods start at midnight in the app's zone, checked across the end of daylight saving time in Warsaw and in UTC.
- Ask 3 (reserve, settle, release): exact refusal with `remaining` and `resetsAt`; `0.1 + 0.2` fills `0.3` exactly
  (the check runs in `numeric`); the per-account and provider-wide budgets are checked together; two reservations
  started at once with room for one: exactly one passes; an expired reservation stops counting; double settle and
  release answer `metering.reservation_not_found`.
- Ask 4 (getSpend, adapters, privacy, prune): llm usage becomes a usd charge with the account from its attributes,
  a `null` cost records nothing, a non-usd provider throws; the footage recorder records seconds or credits, prices by
  `creditsPerSecond`, and `flush` reports a failed write once, after the others finished; privacy exports and
  anonymises while totals stay; prune keeps 32 days at least and removes expired reservations, also on its schedule.
- Deviation: the plan split the source over three phases; the source landed in phase 1 and phases 2 and 3 added the
  tests and docs for their parts. Every part is covered by its phase's tests.
- Found while implementing: `greatest()` skips nulls, so `remaining` without a limit came out 0 instead of `null`;
  it is now null explicitly (`getSpend` test without a budget). The optional `jobs` peer is named in `dependsOn`
  (`^0.1.6?`), as the repository test requires.
- Gates: typecheck, ESLint and the language gate green in the pre-commit hook; metering tests 46 of 46,
  `tests/repo/packages.test.ts` green; `npm run build` green for every package.

Verdict: approved.

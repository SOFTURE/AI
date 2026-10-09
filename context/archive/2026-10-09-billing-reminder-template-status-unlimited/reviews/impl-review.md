# Implementation review: billing-reminder-template-status-unlimited

Reviewed: the branch diff against plan.md, change.md and issue #323.
Verdict: **approve**.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | Every new option is opt-in: the existing reminder, script and badge tests pass unchanged, so 0.1.10 output holds. | No change. |
| 2 | Check | A `buildMail` returning null skips before `deliverOnce`, so nothing is written to the ledger and a later run asks again; it is not paused after. | No change. |
| 3 | Check | The status script's `run` only reads (account lookup, `findEntitlementRecord`); the `--commit` test shows no row is created for a derived account. Output carries the user id, never the email (tested). | No change. |
| 4 | Warning | The status script's tests live in a new `tests/status-script.test.ts`, not `tests/trial-scripts.test.ts` as planned. | Accepted; plan.md amended. A file per script matches `plan-scripts.test.ts` and `trial-scripts.test.ts`. |
| 5 | Suggestion | `formatLastDay` (`YYYY-MM-DD`) is now duplicated between `trial-scripts.ts` and `status-script.ts`. | Accepted as is: three lines, private to each script; moving it would touch `trial-scripts.ts` for no behaviour. |
| 6 | Check | `unlimited` takes precedence over `trial-ending` / `paid-ending` only when days left exceed the threshold, which a reminder window (days, not years) never reaches. | No change. |
| 7 | Warning | The notice frame offers only `neutral` and `danger`: `@softure-ai/ui` compiles no warning or success border or 10% surface (architecture test), and adding them is out of scope. | No change. |

Gates: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` green.

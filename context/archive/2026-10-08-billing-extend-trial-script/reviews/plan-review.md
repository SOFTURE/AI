# Plan review: billing-extend-trial-script

Reviewed: plan.md against change.md, issue #243 and the code on master `c323892`.
Verdict: **approve after fixes** (applied to plan.md).

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | `--days` reads the current trial end before `extendTrialManually` locks the row, so a concurrent extension between the read and the lock could make the computed end not later than the new one. | Accepted as is: `extendTrialManually` re-reads under the lock and refuses `billing.trial_not_extended`, which writes nothing; the operator re-runs. No silent shortening is possible. Stated here, no plan change. |
| 2 | Warning | The issue's wording "`+N days` from `greatest(now, trial_end)`" could be read as 24-hour steps from the current instant, leaving a trial ending mid-day. | Fixed: the plan counts calendar days in the app's time zone and ends at the start of a day, like every other trial end; the example dates are in Key decisions and become test cases. |
| 3 | Suggestion | An unbounded `--days` could overflow a `timestamptz` (year 294276) or the JS date range. | Fixed: capped at 36500 (`MAX_EXTEND_DAYS`), a usage error above. |
| 4 | Suggestion | The issue proposes a `softure-billing extend-trial` binary; the package has no binary for its other scripts. | Out of scope, stated in plan.md: the README shows the same one-file runner as for `grant-plan`. |
| 5 | Check | `lead` defaults to none, so 0.1.8 pages render unchanged; the test asserts that. | No change. |
| 6 | Check | Refusals and the recorded row come from `extendTrialManually`; no migration is needed (`extended_by` nullable since 0010). | No change. |

No lesson ignored.

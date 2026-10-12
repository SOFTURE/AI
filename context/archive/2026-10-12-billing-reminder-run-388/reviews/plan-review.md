# Plan review: billing-reminder-run-388

Reviewed plan.md against change.md, issue #388 and the package on master `1bf1d1f`. Mode: autonomous (decisions
taken, recorded here).

| # | Severity | Finding | Decision |
|---|---|---|---|
| F1 | Warning | The summary changes shape: a caller reading `skipped` as "already sent" or `rejected` as a number breaks. | Accepted: the issue asks for the run's counts; billing is 0.x and the CHANGELOG names the change and the mapping. |
| F2 | Warning | `extract(epoch …)` is `double precision` before Postgres 14, which can lose the last microsecond digit. | Accepted: the module standard targets Postgres 16 (CI's service, PGlite); noted in the doc comment. |
| F3 | Warning | Matching the stored column by kind could pick the wrong end if a policy moved it. | Fixed in the plan: the column is used only within a millisecond of `endsAt`, else `endsAt` in µs. |
| F4 | Suggestion | With `stopOnRetryLater` on by default, the run now stops at the first outage where 0.1.11 went on. | Accepted: it saves every other account's attempt; the option is passed through. |

No finding blocks the plan.

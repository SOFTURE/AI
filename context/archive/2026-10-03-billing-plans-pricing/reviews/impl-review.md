# Implementation review: billing-plans-pricing

Reviewer: an independent read of `git diff origin/master...HEAD` (modules/billing, examples/next-app),
for correctness only. Verdict: no blocking finding.

| # | Finding | Severity | Outcome |
| --- | --- | --- | --- |
| 1 | The test of two concurrent grants ran on PGlite (one connection), so it could not fail | minor | fixed: the test says what it proves; the lock was checked on Postgres with two psql sessions (READ COMMITTED: the second insert waits, inserts nothing, re-locks the committed row and builds on it) |
| 2 | Month periods clamp to the last day and renewals continue from there (31 January, then the 28th) | minor | kept, documented in README §3; a provider anchors its own billing day (MO-3) |
| 3 | `startPaymentAction` read the plan field before the session check | minor | fixed: the session is checked first |
| 4 | A lifetime account can still request an invoice, and a dated grant to it is a silent no-op | minor | deferred to followups FU-9 |
| 5 | Unreachable grant errors (`end_not_in_future`, `read_only`) map to `account_unknown` | none | confirmed unreachable |
| 6 | The e2e grant test matched the toast host as a second `status` | minor | fixed during the e2e run: the status is filtered by the account's email |

Checked without findings: period math across DST, month ends and leap years; the event resolver runs
under the row lock on both paths; every action checks the session or `adminRole` and binds no ids;
`startPayment` counts the bucket first and validates the plan and invoice fields; `redirect` sits
outside the try; client components get only serializable props.

Deferred: stored requests, revoke, grant history and lifetime handling in the admin page, recorded as
followups FU-9 (`billing-admin-requests`).

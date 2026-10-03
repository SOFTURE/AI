# Implementation review: billing-entitlements

Reviewer: an independent read of `git diff origin/master...HEAD` (modules/billing, examples/next-app),
for correctness only. Verdict: no blocking finding.

| # | Finding | Severity | Outcome |
| --- | --- | --- | --- |
| 1 | A refused event used to commit the row the change had already inserted (caught by the test "refuses an end in the past and stores nothing" during implementation) | blocking | fixed before review: the event is applied first, the row is written only on success |
| 2 | The e2e expected exactly "14 days left"; a registration a second before midnight in Warsaw renders 13 | minor | fixed: the e2e accepts 13 or 14 |
| 3 | `getStartOfDay` in a zone that skips midnight lands on the first instant after the gap | none | documented behaviour, confirmed for America/Santiago |
| 4 | `changeEntitlement` under READ COMMITTED: a concurrent insert is waited for and applied on; account deletion waits on `FOR KEY SHARE` | none | confirmed |

Checked without findings: access covers instants before its end (read-only at the end itself), the
guard fails closed (`requireWriteAccess` maps a missing entitlement to `billing.read_only`), the
privacy export and deletion are scoped to the account id, and the e2e cleans up only its worker's rows.

Deferred: a reminder mail before access ends, recorded as followups FU-5 (`billing-reminder-mail`).

# Plan review: billing-admin-requests

Reviewed: plan.md @ 2026-10-04. Mode: deep. Verdict: ready after fixes.
Findings: 0 critical, 2 warnings, 2 suggestions.
Grounding: 14/14 paths, 11/11 symbols, 3/3 commands

## Lenses
| Lens | Result |
| --- | --- |
| Coverage and end state | PASS |
| Slicing | PASS |
| Verifiability | PASS |
| Data and migrations | PASS |
| Tests | WARN (W2) |
| Security | WARN (W1) |
| Lean | PASS |
| Fit | WARN (S1) |
| Cost and defaults | PASS (S2) |

Checked and holding: the lock order of grant and revoke (account → own row → entitlement) never
inverts against `refundPayment` or `changeEntitlement`; `applyPlan` inside the grant's transaction
re-locks rows the transaction already holds (a savepoint, as `recordPayment` does); the request
upsert targets the partial index, so a closed row is never reopened; a refusal (unknown plan,
lifetime, closed request) is decided before the first write, so no transaction commits half a grant.

## Findings

### W1 [WARNING] The account lookup puts an email address in the URL
**Effort:** low. **Lens:** Security. **Where:** Phase 2, step 3 (`?account=` GET lookup)
**Problem:** a GET form with the email lands the address in access logs, browser history and
`Referer` headers. Admin-only, but avoidable personal data in logs.
**Fix:** the lookup is a server action (`findAccountAction`, role checked first) that redirects to
`?account=<user id>`; the page reads the id (UUID-checked). Request rows link to the same view.
**Decision:** Fix now (applied) - Phase 2 steps 1 and 3 updated.

### W2 [WARNING] Existing tests pin the old shapes
**Effort:** low. **Lens:** Tests. **Where:** Phase 1, Tests · `tests/privacy.test.ts:23`, `tests/messages.test.ts:4`, `tests/payments.test.ts:102`
**Problem:** the privacy export test compares the whole export object, the messages test lists
every code, and the manual request test asserts only the hand-over; the plan did not name them, so
"tests pass" could be reached by loosening them.
**Fix:** name them as updated cases: export gains `paymentRequests` and `manualGrants` with exact
values; the code list gains the three new codes; the hand-over test also reads the stored row.
**Decision:** Fix now (applied) - listed under Phase 1 Tests.

### S1 [SUGGESTION] `grantPlan` stays a way to grant without a record
**Effort:** low. **Lens:** Fit. **Where:** Phase 1, step 4 · `src/server/plans.ts` (`grantPlan`)
**Problem:** the public `grantPlan` keeps granting with no history row, so a grant made through it
cannot be revoked and FU-21 will not count it.
**Fix:** keep it (public since MO-2, used by `recordPayment` through `applyPlan`), say in its JSDoc
and README §4 that admin grants go through `grantPlanManually`.
**Decision:** Fix now (applied) - Phase 2 step 7 (README) and Phase 1 step 4.

### S2 [SUGGESTION] The optional `grant-plan` script needs a home
**Effort:** low. **Lens:** Cost and defaults. **Where:** Goal, Out of scope
**Problem:** skipping it silently loses the roadmap's option.
**Fix:** file it in `roadmap-followups` as the next free FU number.
**Decision:** Fix now (applied) - Phase 2 step 7 already carries it.

## Triage summary
Fixed: W1, W2, S1, S2. Accepted: -. Deferred: -. Dismissed: -. Verdict after triage: ready.

## Decisions (auto)
- W1 → redirect to the account id (no email in URLs; one extra action).

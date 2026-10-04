# Implementation review: billing-invoice-request-hygiene

Reviewed: 057101a, 339406e, 68a133f on `claude/fu-27-invoice-request-hygiene-y4gxer` against plan.md
and change.md. Mode: deep (personal data, a migration). Verdict: ready.
Findings: 0 critical, 0 warning, 3 suggestion (1 fixed, 1 deferred, 1 accepted).

## Verdict

Every Done-when criterion is met and checked: gates green (typecheck, lint with the language gate,
2688 tests incl. the Postgres lock tests on a local Postgres 16, build), the billing e2e specs and
the migrations ledger pass on the built example app (20 passed). Three mutations each fail the new
tests (below).

## Dimensions

| Dimension | Result |
| --- | --- |
| Plan coverage | PASS: all three phases, plan review fixes W1, W2, S1 applied |
| Correctness | PASS: store, claim, release; price snapshot from the closed request's `RETURNING` inside the grant transaction |
| Data | PASS: `0006` forward-only with rollback; `NOT VALID` CHECKs checked on PGlite and Postgres; old open rows backfilled `handed_over_at = requested_at` |
| Security | PASS: `\p{Cc}` refused at the boundary (zod) and in the database; actions unchanged (guard tests of FU-26 pass) |
| Privacy | PASS: expiry clears details; export carries prices and `expired` |
| Tests | PASS: unit, PGlite DB CHECK, e2e (one mail for two asks, too-long tax id, expiry script, prices in the admin page) |
| Conventions | PASS: English only, copy in dictionaries, codes as values, options documented |
| Docs | PASS: README §1, §3, §4, §5, §11, §12; example README |

## Plan coverage

| Goal | Evidence |
| --- | --- |
| Stored before the hand-over, once per open request, retried after a failure | `src/server/plans.ts` `startPayment`; `tests/payments.test.ts` "stores the request before handing it over", "hands an open request over once", "hands over once when two asks run at once", "answers payment_failed …", "releases the hand-over when the provider throws" |
| zod schema, a code per field problem, limit in the copy, DB refuses control characters | `src/invoice.ts`; `tests/invoice.test.ts`; `tests/pricing.test.tsx`; e2e "a too-long tax id …" |
| Expiry after `requests.expireAfterDays` | `expireStaleRequests` in `src/server/requests.ts`; `tests/grants.test.ts`; e2e "a request nobody asked again for expires …" |
| Prices on requests and grants | migration `0006`; `grantPlanManually`; `tests/grants.test.ts` "records the price the request quoted …"; e2e price lines |

**Mutations (not committed):** dropping `handed_over_at IS NULL` from the claim fails 4 tests;
dropping the release after an `Err` fails 1; dropping the control-character check fails 8.

## Findings

### F1 [SUGGESTION] A claim left by a crash is never retried
**Where:** `src/server/requests.ts` `claimHandOver`. A process that dies between the claim and the
provider's answer leaves `handed_over_at` set; later asks only refresh the request. Documented in
README §12; the admin page lists the request and expiry clears it.
**Decision:** Defer - FU-34 (`billing-stale-handover-claim`).

### F2 [SUGGESTION] The form-level `invoice_details_invalid` copy said "fill in this field"
**Where:** `src/messages/{en,pl}.ts`. With field errors the form shows only the field texts, so the
form-level text now reads "Check the invoice details below."
**Decision:** Fixed in 339406e.

### F3 [SUGGESTION] Expiry counts 24-hour days, not local calendar days
**Where:** `expireStaleRequests`. The age is a retention bound, not a deadline a person sees; an
hour around a DST change does not matter. README says "days".
**Decision:** Accept.

## Progress audit

All Automated items ticked with their phase SHA; no Manual items.

## Triage summary

Fixed: F2. Deferred: F1 (FU-34). Accepted: F3.

## Lessons proposed

None.

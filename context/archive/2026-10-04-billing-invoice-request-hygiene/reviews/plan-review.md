# Plan review: billing-invoice-request-hygiene

Reviewed: plan.md @ 2026-10-04. Mode: deep (personal data, a migration). Verdict: ready after fixes.
Findings: 0 critical, 2 warning, 3 suggestion.
Grounding: 31/31 paths, symbols and commands named in plan.md exist on e9d910a (new files aside:
`src/invoice.ts`, `migrations/0006_*`, `scripts/expire-invoice-requests.ts`).

## Lenses
| Lens | Result |
| --- | --- |
| Coverage and end state | PASS: S1-S4 of the MO-2 retro review each map to a phase |
| Slicing | PASS: three phases, each shippable |
| Verifiability | PASS |
| Data and migrations | WARN (W1) |
| Tests | PASS |
| Security | PASS: control characters refused at the boundary and in the database |
| Lean | PASS |
| Fit | WARN (W2) |
| Cost and defaults | PASS: 30 days, configurable |
| Scope | PASS: lane C neighbours named out of scope |
| Reuse | PASS: conditional `UPDATE` claim as `dismissPaymentRequest` |
| Lessons | PASS (L-002) |
| Progress format | PASS |

## Findings

### W1 [WARNING] `NOT VALID` CHECKs and the new status must work on PGlite and in the export type
**Effort:** low. **Lens:** Data. **Where:** plan Phase 1 step 1 · `src/server/privacy.ts:38`
**Problem:** The unit tests run on PGlite; if it rejects `NOT VALID` or the `\x80-\x9f` range,
Phase 1 stalls late. The export's `status` union lists three values; `expired` rows would be
exported with a type that does not admit them.
**Fix:** Run the migration on PGlite first in Phase 1 (a test that inserts a newline directly), and
widen `BillingPaymentRequestData.status`.
**Decision:** Fix in plan (Phase 1 step 1 and step 5).

### W2 [WARNING] A refresh after the hand-over leaves the owner's mail with old details
**Effort:** low. **Lens:** Fit. **Where:** plan Goal 1 · `examples/next-app/messages/en.ts:57`
**Problem:** The owner may invoice from the mail while the buyer corrected the address since. The
admin page shows the latest details, but nothing says so.
**Fix:** README §12 states that the admin page, not the mail, holds the current details; the
example mail says to check them there before invoicing.
**Decision:** Fix in plan (Phase 1, example copy and README).

### S1 [SUGGESTION] The release must rethrow a provider's throw
**Effort:** low. **Lens:** Fit. **Where:** plan "Release"
**Problem:** A `try/catch` that releases could swallow the error and answer `payment_failed`,
hiding a bug the action reports as unexpected today.
**Fix:** Release, then rethrow; a test asserts the throw reaches the caller.
**Decision:** Fix in plan.

### S2 [SUGGESTION] Two asks at once: one may answer `requested` while the other's hand-over fails
**Effort:** medium. **Lens:** Fit. **Where:** plan "Not claimed"
**Problem:** Same account, same plan, two tabs: the second ask sees the claim and answers
`requested`; if the first then fails, it is released, but the second tab already said "sent".
**Fix:** None needed now: the request is stored and listed for the admin, the first tab reports
the failure, and the next ask retries. Documented in README §12.
**Decision:** Accept (documented).

### S3 [SUGGESTION] Making `handsOverRequests` required breaks third-party providers
**Effort:** low. **Lens:** Fit. **Where:** `src/payment.ts:42-57`
**Problem:** A provider written against the old contract fails `isPaymentProvider`.
**Fix:** None: `@softure-ai/billing` with the payment contract is not released yet (MO-6 waits for
the owner), so no third-party provider exists. The README names the field.
**Decision:** Dismiss (unreleased contract).

## Triage summary
Fixed in plan: W1, W2, S1. Accepted: S2. Dismissed: S3. Deferred: -.
Verdict after triage: ready.

## Decisions (auto)
- W1 → fix in plan (PGlite first, export type).
- W2 → fix in plan (README and example copy).
- S1 → fix in plan (rethrow).
- S2 → accept (documented; the stored request is never lost).
- S3 → dismiss (unreleased contract).

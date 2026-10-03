# Plan review: billing-provider-adapter

Reviewed: plan.md @ 2026-10-03. Mode: deep. Verdict: ready after fixes.
Findings: 0 critical, 4 warning, 1 suggestion.
Grounding: 14/14 paths, 9/9 symbols (`grantPlan`, `changeEntitlement`, `startPayment`, `PaymentProvider`, `revoke`, `readSmallBody`, `resend`, `postUnsubscribeRoute`, `createTestBilling`), 4/4 commands (`npm run typecheck|lint|test|build`, `npm run e2e`).

Note: written after a first code draft had been started without research and this review (the
owner pointed it out on 2026-10-03). The draft was uncommitted; the findings below were applied to
the plan and checked against the draft before the phase 1 commit.

## Lenses

| Lens | Result |
| --- | --- |
| Coverage and end state | WARN (W1, W4) |
| Slicing | PASS |
| Verifiability | PASS |
| Data and migrations | WARN (W3) |
| Tests | PASS |
| Security | PASS |
| Lean | PASS |
| Fit | WARN (W2) |
| Cost and defaults | PASS |
| Scope | PASS |
| Reuse | PASS |
| Lessons | PASS |
| Progress format | PASS |

## Findings

### W1 [WARNING] The roadmap's baseline is not provable in this change
**Effort:** low. **Lens:** Coverage and end state. **Where:** Goal (plan.md) · roadmap MO-3 Baseline
**Problem:** The roadmap's "after" is "a sandbox payment turns a trial into paid without owner
action". No Stripe credentials exist in the session, and Stripe cannot deliver a webhook to a CI
run, so a browser payment end to end cannot run here. The plan said "the followups gaps" without naming them.
**Fix:** Prove the two halves separately (the Checkout API against the sandbox when the key is set;
the webhook with signed fixtures in e2e) and name the followup for the full browser payment.
**Decision:** Fix now (applied) - Phase 2 names the followups.

### W2 [WARNING] Manifest, env and mount were not in any step
**Effort:** low. **Lens:** Fit. **Where:** Phase 1 · `modules/billing/src/index.ts:30-37`, `modules/mailing/src/index.ts:24-46`
**Problem:** A new table, two secrets and a route handler change the manifest; `tests/module.test.ts`
compares `module.json` with it, and the example's migration list (`e2e/migrations.spec.ts`) changes.
**Fix:** Add the manifest, `module.json`, health check and migration list to the phases.
**Decision:** Fix now (applied).

### W3 [WARNING] Lock order of the new writes was unstated
**Effort:** medium. **Lens:** Data and migrations. **Where:** Approach · `server/entitlements.ts:90`, `server/privacy.ts:74`
**Problem:** A refund that locks the payment row before the account, while the privacy erase holds
the account and deletes payments, can deadlock.
**Fix:** One order everywhere: account, then payment, then entitlement; the refund reads the
payment's account without a lock, locks the account, then updates conditionally.
**Decision:** Fix now (applied) - the decision row "Lock order".

### W4 [WARNING] A full refund revokes all paid access, not one payment's period
**Effort:** high. **Lens:** Coverage and end state. **Where:** Approach, "Refund" · `entitlement.ts:58-59`
**Problem:** `revoke` clears `paid_until` and `is_lifetime`. With two stacked months, refunding one
takes both; refunding a monthly payment also ends a lifetime bought separately.
**Fix A (Recommended):** keep `revoke` (MO-1 built it for refunds), document it in the README and file
a followup for per-payment reversal (needs the grant's start and end stored per payment and a
shortening event). Strength: no change to the entitlement state machine in a money change. Trade-off:
over-revokes in a rare case the owner resolves with a manual grant. Confidence: high. Blind spot: how often stacked payments happen.
**Fix B:** add a shortening event now. Strength: exact. Trade-off: changes MO-1's state machine and
its invariants ("never shortens") inside a high-risk change. Confidence: medium.
**Decision:** Defer (Fix A) - followups entry; README limitation.

### S1 [SUGGESTION] Log the checkout id of a payment that grants nothing
**Effort:** low. **Lens:** Security. **Where:** Approach, "Failed grant"
**Problem:** "logged" without the id leaves the owner unable to find the payment to refund.
**Fix:** log the checkout id (an opaque Stripe id, no personal data).
**Decision:** Fix now (applied).

## Triage summary

Fixed: W1, W2, W3, S1. Accepted: -. Deferred: W4. Dismissed: -. Verdict after triage: ready after fixes.

## Decisions (auto)

- W1 Baseline not provable → Fix now (clear fix; credentials are an owner fact).
- W2 Manifest steps → Fix now.
- W3 Lock order → Fix now.
- W4 Over-revoking refund → Defer, Fix A (Fix B would change MO-1's invariants inside this change).
- S1 Checkout id in the log → Fix now (cheap).

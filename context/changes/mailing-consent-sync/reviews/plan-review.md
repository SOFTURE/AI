# Plan review: mailing-consent-sync

Reviewed: plan.md against change.md, research.md and the roadmap item FU-3 (author's review, `--auto`).
Verdict: approve. Findings: 0 critical, 3 warning, 1 suggestion.

## Lenses

- Outcome coverage: the withdrawal on unsubscribe (hook plus waitlist handler) and the lift on a new
  sign-up both map to plan lines and to unit and e2e tests; both unknowns are answered in research.
- Data integrity: the hook shares the suppression's transaction and the lift shares the join's.
- Security and abuse: the lift needs no link, see W2.

## Findings

### W1 [WARNING] A re-join after an opt-out keeps withdrawn scopes on the sign-up
**Where:** `joinWaitlist` widening.
**Problem:** after an unsubscribe withdraws `launch` and `newsletter`, re-joining with `launch` only
lifts the suppression while `signups.scopes` still lists `newsletter`; `listSignups({ scope:
"newsletter" })` would then mail someone whose newsletter consent is withdrawn.
**Decision:** Fixed in the plan - when the join lifted an own opt-out, the scopes become the
requested ones (the opt-out withdrew everything); otherwise they widen as before. Tested.

### W2 [WARNING] Anyone can lift an address's opt-out by signing it up
**Where:** the lift in `joinWaitlist`.
**Problem:** without double opt-in a third party can undo an opt-out by typing the address.
**Decision:** Accepted for this item - bounded by the `waitlist-email` bucket; the README states
it, and FU-2's backlog entry gets the note that the lift moves to the confirmation.

### W3 [WARNING] Without the hook wired, a lift erases the only record of the opt-out
**Where:** `liftSuppression`.
**Problem:** the suppression row is deleted; the withdrawal row exists only when the app wired
`withdrawWaitlistConsents`.
**Decision:** Fixed in docs - the waitlist README's configuration shows the hook as part of the
setup and the example app wires it; the ledger's new grant row records the re-consent either way.

### S1 [SUGGESTION] Call the hook for operator suppressions too
**Decision:** Rejected - a bounce or a script's block is not the person withdrawing consent.

## Triage summary

All warnings decided; nothing pending.

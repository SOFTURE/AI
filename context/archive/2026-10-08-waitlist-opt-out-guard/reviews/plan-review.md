# Plan review: waitlist-opt-out-guard

Reviewed: `plan.md` against `change.md`, issue #237, `modules/waitlist/src/server/signups.ts`,
`src/next/actions.ts`, mailing's `suppressions.ts`, the waitlist tests and the example app's e2e.

Verdict: **approve with fixes applied** (two findings accepted into the plan, one recorded as accepted risk).

## Findings

### F1 (Warning, low effort): the example app's e2e must not depend on the old lift — checked, no change
`examples/next-app/e2e/waitlist.spec.ts` ("signing up again after unsubscribing lifts the opt-out only through the
link") runs with `doubleOptIn: true` (`examples/next-app/softure.config.ts`), so the lift stays in `confirmSignup`
and the spec holds. No e2e change needed. **Decision:** no plan change; noted here so the impl review does not
re-open it.

### F2 (Warning, low effort): the operator-suppression test changes meaning — accepted
`tests/unsubscribe.test.ts` "keeps an operator's suppression and widens as usual" asserts the old behaviour for an
operator row. D2 makes every suppression block, so the test must assert the new outcome (nothing widened, no
consent recorded), not be deleted. **Decision:** the plan's "update the existing expectations" now names this test
explicitly; it is rewritten, not removed.

### F3 (Suggestion, low effort): the README still promises the lift for imported opt-outs — accepted
README § 10 says imported unsubscribed rows get "an opt-out their next sign-up lifts", and `import.test.ts` asserts
it without double opt-in. Both must say "a confirmed sign-up (double opt-in)". **Decision:** covered by D5; the
import test asserts the new outcome without double opt-in.

### F4 (Suggestion): a concurrent unsubscribe between the check and the write — accepted risk
The check reads the suppression list inside the sign-up's transaction but does not lock it; an unsubscribe that
commits between the check and the consent write leaves a granted consent next to a fresh opt-out. List mail still
goes nowhere (mailing checks the suppression list at send time) and the order is the same as a sign-up followed by
an unsubscribe a moment later. Locking mailing's table from the waitlist would couple the modules for a window of
milliseconds. **Decision:** no lock; D3 already removes the worse half of this race (the join path lifting a
concurrent opt-out).

## Checks that passed

- Validation order: the email, scopes and channel are refused before the suppression check, so a refused form
  still answers its refusal and an attacker cannot use the refusal to probe the list (the form error does not
  depend on suppression).
- The action's answer for `suppressed` equals `joined`'s (D4), including `unsubscribeUrl`, so the form does not
  enumerate opt-outs.
- With double opt-in, `requestConfirmation` writes no consent and lifts nothing; `confirmSignup` still lifts
  (existing `confirmation.test.ts` cases).
- No other package calls `joinWaitlist` (`grep` over the repo).

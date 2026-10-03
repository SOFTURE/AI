# Implementation review: mailing-consent-sync

Reviewed: commits 9c64be0 and e0f16b2 against plan.md (author's review, `--auto`).

## Verdict

Approve. Findings: 0 critical, 1 warning, 2 suggestions.
Evidence: gates green (typecheck, lint with the language gate, `npm test`: 2220 passed after the
roadmap row fix, build); `npm run e2e` on PostgreSQL 16: 78 passed, including the two changed tests
of `e2e/waitlist.spec.ts` (withdrawal on unsubscribe; lift and scope replacement on a new sign-up).

## Dimensions

Correctness, data integrity (transactions), security (who can lift an opt-out), docs.

## Plan coverage

Every Goal line is implemented and tested: the hook and its transaction
(`modules/mailing/tests/suppressions.test.ts`), `liftSuppression` by source, the `{ emailKey }`
subject (`modules/privacy/tests/consents.test.ts`), the waitlist handler, the lift and the scope
replacement (`modules/waitlist/tests/unsubscribe.test.ts`), the example wiring and e2e.

Drift: `withdrawWaitlistConsents` returns `Promise<void>` so it fits the hook type as is
(`onUnsubscribed: withdrawWaitlistConsents`); tests read the ledger instead of a return value.
`widenSignup` became `updateSignup(mode)` with `getWidenedScopes` split out.

## Findings

### W1 [WARNING] A hook failure blocks the person's opt-out
**Where:** `unsubscribe` in `modules/mailing/src/server/suppressions.ts`.
**Problem:** a throwing `onUnsubscribed` rolls back the suppression; the person keeps receiving list
mail until it is fixed.
**Decision:** Kept by design (plan, research risks) - the alternative recreates the gap. The route
answers 500 so mail clients retry, the page offers a retry, the failure is logged by label, and the
waitlist handler only fails on a database error, which would fail the insert too.

### S1 [SUGGESTION] Detect a missing hook at startup
**Decision:** Rejected - mailing cannot know which modules hold mail consents; the waitlist README
and the example app show the wiring.

### S2 [SUGGESTION] Index for consent reads by email key and purpose
**Decision:** Kept - the handler reads at most 16 purposes per unsubscribe, through privacy's
existing subject index.

## Progress audit

All Progress items checked with their commit SHA.

## Triage summary

Nothing pending.

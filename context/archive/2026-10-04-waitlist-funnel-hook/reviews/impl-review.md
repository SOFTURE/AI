# Implementation review: waitlist-funnel-hook

Reviewed: commits 9d16d99 and e05001d against plan.md (author's review, `--auto`).

## Verdict

Approve. Findings: 0 critical, 2 warning, 1 suggestion.
Evidence: gates green (typecheck, lint with the language gate, `npm test`: 2385 passed, build);
`npm run e2e` on PostgreSQL 16: 88 of 88 passed, among them the new
`e2e/analytics-funnel.spec.ts` test (a sign-up from `/?z=<channel>` mails a link ending in
`&z=<channel>`, counts nothing before the link is used, then `waitlist: 1` under the channel).

## Dimensions

Correctness (when the hook runs, its context), failure paths (a throwing hook in both paths, a
throwing or hostile rewrite), security (the rewritten link stays on the app and keeps its token,
no token in logs), contracts (auth's hook shape, `countRegistration` unchanged for callers), docs.

## Plan coverage

Every Goal line is implemented and tested in `modules/waitlist/tests/joined-hook.test.ts`: one call
in the transaction for a new sign-up and none for repeats or widenings; a row left unconfirmed by
an earlier double opt-in counts once without it; with double opt-in no call at the request, one at
the first confirmation, none for a reused link or a second request; a throwing hook rolls back the
sign-up (no row, no consent) and leaves the link usable; both options refuse non-functions; the
rewrite's result is mailed, and eight hostile or broken results plus a throw fall back to the
module's link with a log line that carries no token. `countFunnelStep` counts a non-auth event
under its channel (`modules/analytics/tests/next.test.ts`); the existing `countRegistration` tests
pass unchanged. READMEs: waitlist §3, §10, §12; analytics §1, §3, §10, §12 (the FU-8 line removed).

Drift: `resolveConfirmationLink` is exported from `/server` (not in the plan) so an app can read
the link as it will be mailed; the example's rewrite lives in `lib/waitlist-channel.ts` rather
than inline in `softure.config.ts`, like its other helpers.

## Findings

### W1 [WARNING] A hook error at join answers the generic error on the form
**Where:** `joinNow` → `notifyJoined`.
**Problem:** a broken app hook refuses every waitlist sign-up.
**Decision:** Kept - the same policy as auth's `onRegistered` (the plan's decision); README §10
says a hook that must never refuse catches its own errors, and `countFunnelStep` does.

### W2 [WARNING] The rewrite depends on request headers inside `after()`
**Where:** `deliverConfirmationMail`, called by the join action in `after()`.
**Problem:** a Next change could hide the headers there, and the link would lose the channel.
**Decision:** Kept - Next documents request APIs inside `after()` for server functions, the e2e
pins the tagged link, and a failure only falls back to the untagged link (logged), never breaks it.

### S1 [SUGGESTION] Use FU-7's `tagRedirect` in the example once it lands
**Decision:** Applied when FU-7 reached master first: the example and waitlist README §10 use
`rewriteConfirmationLink: tagRedirect` (same shape), and `lib/waitlist-channel.ts` is gone.

## Progress audit

All Progress items checked with their commit SHA.

## Triage summary

Nothing pending.

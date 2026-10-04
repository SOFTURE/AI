# Plan review: waitlist-funnel-hook

Reviewed: plan.md against change.md, research.md and the roadmap item FU-8 (author's review, `--auto`).
Verdict: approve. Findings: 0 critical, 3 warning, 1 suggestion.

## Lenses

- Outcome coverage: the `onJoined` hook in the transaction, the three unknowns answered, a channel
  that survives double opt-in, an e2e counting a tagged sign-up.
- Contracts: auth's `onRegistered` shape, analytics' `countRegistration` kept, FU-7's
  `rewriteRedirect` shape, the strict options schema.
- Security: a rewritten confirmation link (open redirect, token loss).
- Failure paths: a throwing hook, a throwing rewrite inside `after()`.

## Findings

### W1 [WARNING] An earlier unconfirmed row applied without double opt-in is not "new"
**Where:** `joinNow` → `applyRequest`.
**Problem:** an app that turned double opt-in off keeps unconfirmed rows; their first count has
`isNew: false`, so keying the hook on `isNew` would miss them.
**Decision:** Fixed in the plan - the hook keys on `confirmedAt` going from null to set, in both
paths; a unit test covers it.

### W2 [WARNING] The rewrite could point the link off the app
**Where:** `rewriteConfirmationLink`.
**Problem:** a buggy rewrite returning `//evil` or a full URL would put a foreign link in the mail.
**Decision:** Fixed in the plan - only a path starting with one `/` on the confirm route that keeps
the token is used; anything else falls back, tested.

### W3 [WARNING] `headers()` inside `after()`
**Where:** the join action sends the confirmation mail in `after()`.
**Problem:** if Next did not expose the request headers there, the rewrite would see no channel.
**Decision:** Accepted with a check - Next documents request APIs inside `after()` for server
functions; the e2e proves the tag reaches the count. If it failed, the rewrite would move before
`after()`.

### S1 [SUGGESTION] Also count widenings as a separate step
**Decision:** Rejected - no consumer asks for it; the event's `via` leaves room to add a kind later.

## Progress mechanics

One `## Progress`, last; phase titles match; gates items last in their phases.

## Triage summary

All warnings decided; nothing pending.

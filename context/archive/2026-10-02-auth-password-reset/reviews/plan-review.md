# Plan review: auth-password-reset

Reviewed: plan.md @ 2026-10-02 (author's review, `--auto`). Verdict: approve after fixes.
Findings: 0 critical, 2 warning, 1 suggestion.

## Findings

### W1 [WARNING] A sender error or latency would reveal that the account exists
**Where:** Approach, enumeration
**Problem:** calling the sender inside the request makes an existing account slower, and a
failing sender would answer with an error only for existing accounts.
**Decision:** Fix now (applied) - the action counts the buckets and answers first; issuing and
sending run in `after()`, and their failures are only logged (without the link).

### W2 [WARNING] A dev sender as the default would log live tokens in production
**Where:** Phase 1, options
**Problem:** a console default means every app that forgets the option writes reset links into
production logs.
**Decision:** Fix now (applied) - no default sender: without `send` the feature is off; the
console sender refuses under `NODE_ENV=production`.

### S1 [SUGGESTION] A pending link should not survive a normal password change
**Decision:** Fix now (applied) - `changePassword` deletes the user's pending reset in its
transaction.

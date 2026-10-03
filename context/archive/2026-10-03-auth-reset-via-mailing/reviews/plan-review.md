# Plan review: auth-reset-via-mailing

Reviewed: plan.md @ 2026-10-03 (author's review, `--auto`). Verdict: approve after fixes.
Findings: 0 critical, 2 warnings, 1 suggestion.

## Findings

### W1 [WARNING] "{ttlMinutes} minutes" is wrong Polish for most durations
**Where:** Approach, expiry copy
**Problem:** Polish has three plural forms for minutes (one, few, many); one template string
reads wrong for 22, 23, 24 or 32 minutes, which `ttlMinutes` allows.
**Decision:** Fix now (applied) - `resetMail.minutes` holds forms per `Intl.PluralRules` category,
picked with `selectPlural`; tests cover one, few and many.

### W2 [WARNING] Mail kinds arrive in parallel (EN-2)
**Where:** Constraints
**Problem:** if EN-2 makes the kind required or suppresses by default, reset mail could be blocked
for a user who unsubscribed from newsletters.
**Decision:** Fix now (applied) - the EN-2 thread was told reset mail must stay transactional
(omitted kind = transactional, or it sets the kind in `modules/auth/src/mailing/` when it merges).

### S1 [SUGGESTION] An idempotency key per reset link
**Decision:** Defer - the sender is not retried; a key would only matter with the ledger (EN-3).

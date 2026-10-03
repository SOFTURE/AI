# Plan review: mailing-ledger-campaigns

Reviewed: plan.md @ 2026-10-03 (author's review, `--auto`). Verdict: approve after fixes.
Findings: 0 critical, 2 warnings, 1 suggestion.

## Findings

### W1 [WARNING] A missing unsubscribe secret would burn every recipient's attempts
**Where:** Phase 2, campaign command
**Problem:** list mail without `MAILING_UNSUBSCRIBE_SECRET` answers `mailing.unavailable`; a campaign
run would release every claim and, after five runs, close the rows as rejected.
**Decision:** Fix now (applied) - the command refuses to start without the secret, before it opens
the database.

### W2 [WARNING] Database error messages carry query parameters
**Where:** Phase 2, error output
**Problem:** Drizzle wraps driver errors as "Failed query: <sql> params: <values>"; the values hold
recipient keys.
**Decision:** Fix now (applied) - the command prints the driver's own message (the error's cause).

### S1 [SUGGESTION] Provider webhooks for delivered, bounced and complained
**Decision:** Defer - they would extend the ledger with later states; not part of EN-3's outcome.

# Implementation review: waitlist

Reviewed: commits of phases 1 and 2 against plan.md (author's review, `--auto`).
Verdict: approve. Findings: 0 critical, 2 warning, 1 suggestion.
Evidence: gates green (typecheck, lint with the language gate, 1624 unit tests, build);
`npm run e2e` on PostgreSQL 16: 57 passed, including the four tests of `e2e/waitlist.spec.ts` and
the updated ledger, health and export expectations.

## Drift from plan

- `joinWaitlist` returns `recordedScopes` (the consents written now) next to `isNew`, for tests and
  apps that react to a sign-up.
- The scope list check is a SQL function (`waitlist.is_scope_list`): a CHECK cannot use a subquery,
  and per-element length and uniqueness need one.
- The form's field names live in `src/fields.ts`: the action cannot import from the client module.
- `e2e/privacy-export-delete.spec.ts` (EN-7) now expects the `waitlist` part of the export.

## Findings

### W1 [WARNING] Concurrent first sign-ups of one address
**Where:** `joinWaitlist`
**Problem:** two first sign-ups at once could both insert, or record a consent twice.
**Decision:** Fixed by design - `INSERT … ON CONFLICT DO NOTHING` waits for the other transaction;
the loser locks the row (`FOR UPDATE`), widens it and checks the ledger after the winner's commit,
so each scope is recorded once. A test runs two sign-ups at once.

### W2 [WARNING] The confirmation must not promise a mail
**Where:** `messages.form.success`
**Problem:** with `welcomeMail: false`, or a refused mail, "we sent you a welcome mail" is untrue.
**Decision:** Fixed - the copy confirms the sign-up only.

### S1 [SUGGESTION] Answer timing for known addresses
**Decision:** Kept - a repeat sign-up does one more read than a first one; the per-client and
per-address buckets bound what timing can reveal, and the answer itself is identical.

## Security checklist

- The action is public by design: it identifies the client and counts `waitlist` before any work,
  then `waitlist-email` per address; the form's scopes and placement are checked against the config.
- The answer does not tell a new address from a known one; the mail goes out after the answer.
- Scope labels are server-prepared text or app markup; no user input is rendered back except the
  typed address in its own field.
- The export holds the sign-up (no address, the account already has it); account deletion removes
  it before privacy removes the consents and auth the account.

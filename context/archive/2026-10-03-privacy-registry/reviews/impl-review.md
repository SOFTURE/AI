# Implementation review: privacy-registry

Reviewed: commits ad4a0f2 (p1) and f54331e (p2) against plan.md (author's review, `--auto`).
Verdict: approve. Findings: 0 critical, 2 warning, 1 suggestion; all fixed.
Evidence: gates green (typecheck, lint, 1138 unit tests, build); `npm run e2e` on PostgreSQL 16:
38 passed, including the four tests of `e2e/privacy-export-delete.spec.ts`.

## Drift from plan

- The Next adapter, the delete form and their tests landed with phase 1 (they only wire the server
  functions); phase 2 is the example app, its e2e and the docs.
- docs/02 §9 gained a line on the privacy contributor contract and the deletion order.
- auth's README §11 and feature-switches' README §5 and §11 describe their contributors.

## Findings

### W1 [WARNING] A contributor that writes during the export
**Where:** `collectUserData`
**Problem:** the export runs in a read-only, repeatable-read transaction; a contributor that writes
(an audit row, a counter) fails the export with a database error that reads as a generic failure.
**Decision:** Fixed - the README's contributor rules say `exportUserData` only reads and why; the
rate limit attempt is counted before the read-only transaction opens.

### W2 [WARNING] e2e read a link name as a literal
**Where:** `e2e/privacy-export-delete.spec.ts`
**Problem:** the example's own copy ("Your data") was written in the test; a copy change would break
the test without breaking the app.
**Decision:** Fixed - the test reads `en.account.privacy` from the example's dictionary.

### S1 [SUGGESTION] Rate limit rows after a deletion
**Decision:** Kept as is - `security.rate_limits` holds only SHA-256 prefixes of the user id and
email (the scan test confirms neither appears), pruned two windows after they start; deleting them
would let an account reset its own counters. Documented in auth's and privacy's README §11.

## Security checklist

- Deletion needs the session's user, the current password and the confirmation; `privacy-delete`
  counts each attempt per user before the password is checked (unit test: the sixth attempt is
  refused even with the right password).
- The action and the route take the user from the session only; nothing is bound or read from the
  form for identity.
- Deletion is one transaction; a contributor `Err` or a throw rolls back every contributor (unit
  tests for both), and the schema scan proves no column in any schema keeps the user's id or email
  while another user's rows stay.
- The export carries no password or token hash (unit test), is `no-store`, `nosniff`, and bounded
  by `export.maxBytes`.

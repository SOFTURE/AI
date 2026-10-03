# Implementation review: waitlist-double-opt-in

Reviewed: commits baeb87f and 34a5689 against plan.md (author's review, `--auto`).

## Verdict

Approve. Findings: 0 critical, 2 warning, 2 suggestions.
Evidence: gates green (typecheck, lint with the language gate, `npm test`: 2253 passed, build);
`npm run e2e` on PostgreSQL 16: 79 of 80 passed on the first run, the one failure an assertion of
the test itself (the test process's `appOrigin` differs from the server's), removed; the waitlist
and migrations specs then passed (8 of 8).

## Dimensions

Correctness, data integrity (row lock, checks, backfill), security (a link that grants consent,
scanners, logs), privacy (when consents are recorded, expiry), docs.

## Plan coverage

Every Goal line is implemented and tested: the option and its parsing (`tests/module.test.ts`),
migration 0002 and its checks (`tests/signups.test.ts`, "the signups table"), the pending join, the
confirmation (first, used, expired at the boundary, invalid, replaced, rate limited), the lift only
at confirmation, the prune, both mails (`tests/confirmation.test.ts`), the actions and the page
(`tests/next-confirm.test.tsx`), the form state, the privacy export, and the example app's e2e.

Drift: `lockSignup` takes the email (one caller shape); the confirmation drops scopes the config no
longer declares and answers `confirmation_invalid` when none is left.

## Findings

### W1 [WARNING] A scope the app drops from the config between request and link is not granted
**Where:** `confirmSignup`.
**Decision:** Kept - recording a purpose the app no longer declares would write consent the form no
longer offers; the case answers like a stale link and a new sign-up fixes it. Commented in code.

### W2 [WARNING] Without a scheduled prune, expired unconfirmed addresses stay stored
**Where:** `pruneUnconfirmedSignups`.
**Decision:** Kept - the module has no scheduler (auth's prunes follow the same pattern); README §10
and §12 say to run it. A runner for every module's prunes is outside this item.

### S1 [SUGGESTION] Prune opportunistically on each sign-up, like security's rate limits
**Decision:** Rejected for now - it would add a write to every public request; the app's job is
the documented path.

### S2 [SUGGESTION] Name the expiry in the confirmation mail
**Decision:** Rejected - the copy would need interpolation per expiry; the expired page says what
to do.

## Progress audit

All Progress items checked with their commit SHA.

## Triage summary

Nothing pending.

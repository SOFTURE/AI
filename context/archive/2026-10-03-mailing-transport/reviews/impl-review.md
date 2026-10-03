# Implementation review: mailing-transport

Reviewed: commits 46a7f8b (p1) and 09e34d7 (p2) against plan.md (author's review, `--auto`).
Verdict: approve. Findings: 0 critical, 2 warnings, 2 suggestions; W2 and S1 fixed.
Evidence: gates green (typecheck, lint, 1155 unit tests, build); `npm run e2e` on PostgreSQL 16:
37 passed, including the three tests of `e2e/mailing-transport.spec.ts`.

## Drift from plan

- `/next` exports `sendMail` only; the package has no `./ui` entry (no UI) and gains `./testing`.
- The example's action checks the session with `getCurrentUser` and answers `auth.unauthenticated`
  instead of `requireUser` (a redirect inside an action would hide the form's state).
- `fakeMailProvider({ respond })` was added so unit tests and apps can simulate refusals.

## Findings

### W1 [WARNING] One e2e run timed out in an unrelated auth test
**Where:** `e2e/auth.spec.ts`, "the login-account limit stops guessing on one account"
**Problem:** the first full run timed out at 30 s while the unit suite ran on the same machine
(scrypt-heavy logins under CPU contention).
**Decision:** No change - the full Playwright suite passed 37/37 when run alone; the test and the
code it covers are untouched by this change, and CI runs the suites in separate jobs.

### W2 [WARNING] The address pattern could backtrack polynomially (CodeQL, PR #19)
**Where:** `src/address.ts`, `ADDRESS` and the display-name pattern
**Problem:** `[^…]+\.[^…]+` let the domain's dots be split many ways, so a hostile `to` such as
`!@!.` followed by many `!.` took polynomial time; the display-name pattern had the same shape.
**Decision:** Fixed - domain labels exclude the dot (`label(.label)+`), addresses are capped at 254
characters before matching, and the display name is split off with `lastIndexOf("<")` instead of a
regular expression; a test sends a 100 000-character hostile address.

### S1 [SUGGESTION] Display names with commas were accepted unquoted
**Where:** `src/address.ts`, `isMailbox`
**Problem:** `Doe, John <a@example.com>` passed the check, but RFC 5322 reads an unquoted comma as a
second address; the provider would refuse every send.
**Decision:** Fixed - the display name refuses commas, semicolons and quotes at startup (tests
added), documented under Configuration and Limitations.

### S2 [SUGGESTION] Retries are left to the caller
**Decision:** Defer to EN-3 - the delivery ledger owns retry policy; the transport documents that
`unavailable` is retried with the same idempotency key.

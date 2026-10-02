# Implementation review: auth-core

Reviewed: phases 1-3 @ 2026-10-02 (an independent read-only reviewer plus the author's check, unit
tests run). Verdict: approve after fixes. Findings: 0 critical, 3 warning, 7 suggestion, plus one
build failure found by the e2e run.

## Drift from plan

- File names: `cookie.ts` → `session-cookie.ts`, `redirect.ts` → `safe-next-path.ts`;
  `cookie-name.ts` and `form-state.ts` folded into `session-cookie.ts` and `contract.ts`. Harmless.
- Phase 1 named TDD; the server code was written first and its tests right after (noted in the
  p1 commit). The review fixes below were test-first where a test could show the defect.

## Findings

### E1 [CRITICAL, found by e2e] `next/navigation.js` broke `next build` of the session route
**Where:** `src/next/*`
**Problem:** NodeNext needs the `.js` form for Next (no `exports` map), but Next aliases only the
bare specifiers; the `.js` form reached a vendored context file that is not on disk
(MODULE_UNPARSABLE while collecting `/api/auth/session`).
**Decision:** Fix now (applied) - bare `next/navigation` and `next/headers`, typed through
`src/next/next-modules.d.ts`; recorded as a lesson.

### W1 [WARNING] A valid password could be refused at login
**Where:** `src/server/login.ts`
**Problem:** registration counted characters after NFC, login counted UTF-16 units; 600 emoji
registered fine and never logged in.
**Decision:** Fix now (applied) - one `getPasswordLength`; test with 600 astral characters.

### W2 [WARNING] `login-account` lets anyone lock an account for a window
**Decision:** Accept risk, documented (README §3). It is the ID-2 contract and the stronger
protection against distributed guessing; the limit is configurable.

### W3 [WARNING] Missing buckets failed late, as a generic error on every login
**Decision:** Fix now (applied) - `assertAuthBuckets` names the missing buckets once per config;
test added.

### S4 [SUGGESTION] A login over an existing session left the old row valid
**Decision:** Fix now (applied) - login and register end the previous session first.

### S5 [SUGGESTION] No token rotation after a password change
**Decision:** Skip, documented (README §12): every other session ends, and rotating the current
one would need the action to rewrite the cookie for little gain over that.

### S6 [SUGGESTION] Over-long form fields were dropped, not cut
**Decision:** Fix now (applied) - fields are sliced to 4096 characters, as the comment says.

### S7 [SUGGESTION] Guard compared the raw path; example proxy ran on static files
**Decision:** Fix now (applied) - decoded, lowercased comparison (undecodable paths are guarded),
tests; example `proxy.ts` has a `matcher`; README says every private page still calls `requireUser`.

### S8 [SUGGESTION] A bad switch value logged on every request
**Decision:** Fix now (applied) - logged once per process.

### S9 [SUGGESTION] `identifyClient` and `getSoftureConfig` run outside the try in actions
**Decision:** Skip - they throw only on a setup bug (no security module, no config), which should
surface as an error page, not a form message.

### S10 [SUGGESTION] Hashes with an older cost time differently from the dummy check
**Decision:** Skip - only until the next login rehashes them; noted here for the day the cost rises.

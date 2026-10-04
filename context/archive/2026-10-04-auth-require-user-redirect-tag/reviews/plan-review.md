# Plan review: auth-require-user-redirect-tag

Reviewed: plan.md @ 2026-10-04. Mode: deep. Verdict: ready after fixes.
Findings: 0 critical, 1 warning, 1 suggestion.
Grounding: 10/10 paths, 6/6 symbols (`requireUser`, `RequireUserOptions`, `resolveRedirectTarget`, `tagRedirect`,
`tagPath`, `PaymentPage`), 2/2 commands (gates from `workflow.json`, `npm run e2e`)

## Lenses
| Lens | Result |
| --- | --- |
| Coverage and end state | PASS (the guard-free module page, actions via `Referer`, the login round trip) |
| Slicing | PASS (one phase: the option is useless without a caller and the proof) |
| Verifiability | PASS (the e2e asserts the `307`'s own `Location` and must fail with the old redirect) |
| Data and migrations | PASS (none) |
| Tests | PASS after W1 |
| Security | PASS (the rewrite's result still passes `toSafeNextPath`; a throwing rewrite keeps auth's path) |
| Lean | PASS (one option, one moved helper, one line in billing) |
| Fit | PASS (the FU-28 seam; `tagRedirect` already reads page parameters) |
| Cost and defaults | PASS (without `rewriteRedirect` the redirect is unchanged) |
| Scope | PASS (guard, `carry`, `requireRole` and prop-less pages unchanged, reasons recorded) |
| Reuse | PASS (`resolveRedirectTarget`, the pages' parameter conversion moved, not copied) |
| Lessons | PASS (L-002 imports; FU-7's lesson that an e2e must fail without the fix) |
| Progress format | PASS |

Deep checks (done by the reviewer):
- "Existing e2e expectations of untagged login URLs still hold": `billing-pricing.spec.ts:96` opens `/payment?plan=yearly`
  from an untagged pricing page; the page passes parameters without a tag, so `tagRedirect` returns the path unchanged
  (it reads the parameters alone). The `/account` cases are answered by the proxy's guard before any render. Confirmed.
- "The login URL takes the tag": `tagPath("/login?next=%2Fpayment%3Fplan%3Dmonthly", "spring-promo")` appends `&z=…`;
  the encoded `next` is not the channel parameter. Confirmed in `modules/analytics/src/server/channel.ts:48-55`.
- "After login the visitor lands tagged": the login action's redirect to `next` goes through `tagRedirect` with the
  login page as `Referer` (FU-7). Confirmed by the existing case "the sign-up action answers with the tagged account page".

## Findings

### W1 [WARNING] The unit test would read Next's internal redirect digest
**Effort:** low. **Lens:** Tests. **Where:** Phase 1, step 1 (plan.md)
**Problem:** `NEXT_REDIRECT;replace;<url>;307;` is Next's internal format; a Next upgrade could break the test without
any change in auth.
**Fix:** mock `next/navigation`'s `redirect` to throw an error carrying the URL.
**Decision:** Fix now (applied) - step 1 names the mock.

### S1 [SUGGESTION] Keep the guard as the documented first line
**Effort:** low. **Lens:** Fit. **Where:** Phase 1, step 6 (plan.md)
**Problem:** the new option could read as a replacement for the proxy's guard on private prefixes.
**Fix:** both READMEs keep recommending the guard; the option is for pages outside it.
**Decision:** Fix now (applied) - step 6.

## Triage summary
Fixed: W1, S1. Accepted: -. Deferred: -. Dismissed: -. Verdict after triage: ready.

## Decisions (auto)
- Triage in auto mode: both findings fixed in plan.md.

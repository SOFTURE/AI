# Plan review: auth-page-redirect-tag

Reviewed: plan.md @ 2026-10-04. Mode: deep. Verdict: ready after fixes.
Findings: 0 critical, 1 warning, 1 suggestion.
Grounding: 11/11 paths, 7/7 symbols (`redirect`, `resolveRedirectTarget`, `RewriteRedirect`, `tagRedirect`,
`getChannel`, `getChannelFromSearchParams`, `tagPath`), 2/2 commands (gates from `workflow.json`, `npm run e2e`)

## Lenses
| Lens | Result |
| --- | --- |
| Coverage and end state | PASS (both pages, `next`, an own tag; the out-of-scope `requireUser` redirect is a recorded gap) |
| Slicing | PASS (one phase: the context field is useless without the pages and the proof) |
| Verifiability | PASS after W1 |
| Data and migrations | PASS (none) |
| Tests | PASS after W1 and S1 |
| Security | PASS (the page redirect gains `toSafeNextPath` on the rewrite's result; only valid channels are added) |
| Lean | PASS (one optional context field, one branch in `tagRedirect`) |
| Fit | PASS (the FU-7 seam; `getChannelFromSearchParams` already reads page parameters) |
| Cost and defaults | PASS (without `rewriteRedirect` the pages redirect exactly as before) |
| Scope | PASS (actions, proxy and keeper unchanged) |
| Reuse | PASS (`resolveRedirectTarget`, `getChannelFromSearchParams`, `tagPath`) |
| Lessons | PASS (L-002 named; FU-7's lesson that an e2e must fail without the fix is applied in W1) |
| Progress format | PASS |

Deep checks (done by the reviewer):
- "A render's `redirect()` is answered as an HTTP redirect with the given URL": `app-render.js:2386-2390` sets the
  status from the redirect error and the `Location` from its URL. Confirmed.
- "The proxy cannot re-tag the follow-up": `tag` returns null for a URL that already has the parameter (the tagged
  login page itself) and reads the `Referer` for the follow-up, which is the navigation's original referrer (none for
  `page.goto`). Confirmed in `modules/analytics/src/proxy/index.ts`.
- "Existing rewrites keep working": auth's `RewriteRedirect` gains only an optional field; `tagRedirect`'s parameter type
  is wider (`SearchParamsInput` accepts `URLSearchParams`), so `rewriteRedirect: tagRedirect` still typechecks.

## Findings

### W1 [WARNING] The e2e cases could pass without the fix
**Effort:** low. **Lens:** Verifiability. **Where:** Phase 1, step 6 (plan.md)
**Problem:** FU-7's first e2e draft passed without its fix (the proxy re-tagged the follow-up). A case that only checks
the final URL proves nothing unless shown to fail with the old code.
**Fix:** assert the redirect response's own `Location`, and run the cases once against the old `redirect(next)`.
**Decision:** Fix now (applied) - step 6 and Done-when 1.3 require the failing run; the risk line stays as the method.

### S1 [SUGGESTION] The no-JavaScript case adds nothing
**Effort:** low. **Lens:** Tests. **Where:** Phase 1, step 6 (plan.md)
**Problem:** the page's redirect is a document `307`, answered before any script; JavaScript cannot change it, so a
second run without JavaScript doubles e2e time for no new evidence.
**Fix:** drop it; the `Location` assertion covers both.
**Decision:** Fix now (applied) - removed from step 6 and 1.3; reason under Decisions (auto).

## Triage summary
Fixed: W1, S1. Accepted: -. Deferred: -. Dismissed: -. Verdict after triage: ready.

## Decisions (auto)
- Triage in auto mode: both findings fixed in plan.md.

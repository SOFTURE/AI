# Plan review: analytics-action-redirect-tag

Reviewed: plan.md @ 2026-10-03. Mode: deep. Verdict: ready after fixes.
Findings: 0 critical, 2 warning, 1 suggestion.
Grounding: 12/12 paths, 7/7 symbols (`redirect`, `toSafeNextPath`, `getAuthOptions`, `getChannel`, `withChannel`,
`hasChannelParam`, `errorLogLabel`), 2/2 commands (gates from `workflow.json`, `npm run e2e`)

## Lenses
| Lens | Result |
| --- | --- |
| Coverage and end state | PASS |
| Slicing | PASS (one phase: the option is useless without its user and its proof) |
| Verifiability | PASS after W1 |
| Data and migrations | PASS (none) |
| Tests | PASS after W2 |
| Security | PASS (the rewrite cannot leave the app: `toSafeNextPath` on its result; failures keep auth's path) |
| Lean | PASS (one option, two small functions) |
| Fit | PASS (function option like `onRegistered`; lazy `next/headers` like `getChannel`) |
| Cost and defaults | PASS (opt-in; without the option auth is unchanged) |
| Scope | PASS (the page-level redirect is named out of scope and recorded as a gap) |
| Reuse | PASS (`withChannel`, `hasChannelParam`, `getChannel`, `toSafeNextPath` reused) |
| Lessons | PASS (L-002 named) |
| Progress format | PASS |

Deep checks (done by the reviewer):
- "Next renders the target from the URL given to `redirect()`": `action-handler.js:260-330` fetches
  `${origin}${pathname}${search}` of that URL for a fetch action, and `:903-906` sets `Location` to it for a form post.
  Confirmed.
- "The action can read the channel": `getChannel()` reads `Referer` and `Host` from `next/headers`, the same call
  `countRegistration` makes inside `registerAction`'s request; the e2e funnel's `signup` count already proves it.
- Blast radius: every auth action redirect of every app that sets the option; apps that do not set it are unchanged
  (`resolveRedirectTarget` returns the path as is).

## Findings

### W1 [WARNING] The funnel e2e passes with or without this change
**Effort:** low. **Lens:** Verifiability. **Where:** Done when, 1.5 and step 10
**Problem:** since FU-5, `<ChannelKeeper />` tags `/account` in the browser before its beacon runs, so the funnel spec
cannot tell whether the action answered a tagged URL. Only 1.3 (the action's own answer) and 1.4 (no JavaScript, no
keeper) prove FU-7.
**Fix:** 1.3 and 1.4 must fail without `rewriteRedirect` in the example's config; the implementation checks this once
by removing the line and running both, and records the result under Decisions.
**Decision:** Fix now (added to the implementation's checks).

### W2 [WARNING] `x-action-redirect` carries the redirect type
**Effort:** low. **Lens:** Tests. **Where:** step 9
**Problem:** the header is `<url>;<type>` (`action-handler.js:261`), so an exact match on the URL fails.
**Fix:** the test splits on the last `;` and compares the URL exactly (`/account?z=spring-promo`), not a prefix.
**Decision:** Fix now (exact comparison, per the repo's "assert exact values" rule).

### S1 [SUGGESTION] Show the app's own actions how to use `tagRedirect`
**Effort:** low. **Lens:** Fit. **Where:** step 11
**Problem:** the helper is useful beyond auth (`redirect(await tagRedirect("/thanks"))`), but the plan only documents
the auth wiring.
**Fix:** one README line in analytics §4.
**Decision:** Fix now (README step).

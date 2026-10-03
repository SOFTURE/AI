# Plan review: analytics-client-navigation

Reviewed: plan.md @ 2026-10-03. Mode: deep. Verdict: ready after fixes.
Findings: 0 critical, 2 warning, 1 suggestion.
Grounding: 9/9 paths, 6/6 symbols (`parseChannel`, `readChannel`, `getChannelOptions`, `createChannelTagger`,
`FunnelBeaconReporter`, `getSoftureConfig`), 2/2 commands (gates from `workflow.json`, `npm run e2e`)

## Lenses
| Lens | Result |
| --- | --- |
| Coverage and end state | PASS after W1 |
| Slicing | PASS (one phase, one pattern) |
| Verifiability | PASS after W2 |
| Data and migrations | PASS (none) |
| Tests | PASS |
| Security | PASS (no new entry point; the browser only rewrites its own same-origin URL) |
| Lean | PASS |
| Fit | PASS (server component reads config, `/ui` client part, L-002) |
| Cost and defaults | PASS (opt-in mount line; nothing changes for apps that do not mount it) |
| Scope | PASS after W1 |
| Reuse | PASS (`parseChannel` moved, not duplicated) |
| Lessons | PASS (L-001, L-002 named) |
| Progress format | PASS |

Deep checks (done by the reviewer):
- "Next syncs `history.replaceState(null, ...)` into the router": `node_modules/next/dist/client/components/app-router.js:268-279`
  copies Next's internal state when `data` lacks `__NA`/`_N` and calls `applyUrlFromHistoryPushReplace(url)`. Confirmed.
- "The proxy cannot see every router request": `server/web/adapter.js:156-165` deletes `FLIGHT_HEADERS`; `Next-Url` is
  sent only when `nextUrl !== null` (`segment-cache/cache.js:1198`). Confirmed.
- Blast radius of a keeper in the root layout: every client navigation of the example app, including the register
  action's redirect to `/account`, which `analytics-funnel.spec.ts:69-72` expects to count without a channel. See W1.

## Findings

### W1 [WARNING] The funnel e2e asserts the very behaviour the keeper changes
**Effort:** low. **Lens:** Coverage, Scope. **Where:** Phase 1, Files and steps (plan.md)
**Problem:** the first draft listed only `analytics-channel.spec.ts`. A server action's redirect is a router navigation,
so the keeper tags `/account` before its beacon runs; `analytics-funnel.spec.ts` would then count `account` twice (the
redirect view and its own tagged `goto`) and fail. It also overlaps FU-7's outcome.
**Fix:** step 8 updates the funnel spec to the new truth; Risks names the FU-7 overlap and what FU-7 keeps (the server
render of the redirect target); README's FU-7 bullet narrows.
**Decision:** Fix now (applied).

### W2 [WARNING] "Existing tests pass unchanged" while the same files gain tests
**Effort:** low. **Lens:** Verifiability. **Where:** Done when, second bullet
**Problem:** `client.test.ts` and `next.test.ts` gain cases, so "unchanged" must mean no existing case edited, else the
item is unverifiable.
**Fix:** read the item as "no existing test case in `modules/analytics/tests/` edited or removed"; the impl review
checks it from the diff.
**Decision:** Fix now (clarified here; the Progress item text is kept, per the never-rename rule).

### S1 [SUGGESTION] Prove the effect order in the browser, not only by reasoning
**Effort:** low. **Lens:** Verifiability. **Where:** Risks, first bullet
**Problem:** that Next writes the new URL (insertion effect) before the keeper's layout effect is inferred from React's
commit order.
**Fix:** the e2e cases already fail if the order is wrong (the keeper would read the old, tagged URL and do nothing).
**Decision:** Accepted as is.

# Implementation review: observability-otlp

Reviewed: `master...348bfab` @ 2026-10-10 by an independent read-only reviewer, findings verified and fixed in the
session. Verdict before fixes: request changes. Verdict after fixes: approve.
Findings: 0 critical, 4 warning, 6 suggestion.

## Findings

### W1 [WARNING] `createOnRequestError` logged the query string as `url.path`
**Where:** `foundation/observability/src/next/index.ts` · Next passes `path: req.url` (`next/dist/server/base-server.js:472`).
**Problem:** reset, unsubscribe and OAuth tokens in the query reached the console and the OTLP backend.
**Decision:** Fix now (applied) - the path is cut at `?`; test `logs the path without its query string, which can carry tokens`.

### W2 [WARNING] `handleSignals` re-raised the signal into the app's own listener
**Where:** `src/node/start.ts`, `installSignalHandlers`.
**Problem:** with an app SIGTERM listener the re-raise ran it twice and the process did not end; no flush timeout; no tests.
**Decision:** Fix now (applied) - re-raise only without other listeners, flush bounded to 5 s; child-process tests
`tests/signals.test.ts` (both cases; a sabotage of the listener check turns the second red).

### W3 [WARNING] A base endpoint path starting with `//` changed the host
**Where:** `src/node/config.ts`, `appendSignalPath`.
**Problem:** `https://h//foo` resolved to host `foo`, sending the auth header elsewhere; userinfo was dropped.
**Decision:** Fix now (applied) - only the pathname of a copy of the URL changes; tests for `//` and for credentials and query.

### W4 [WARNING] Option headers did not replace environment headers
**Where:** `src/node/config.ts`; the exporters merge environment headers per key anyway (`otlp-http-configuration.js:10-25`).
**Problem:** the plan's critical detail and the README promised otherwise; tests used `toMatchObject`.
**Decision:** Fix now (applied) - one documented rule, merged per key (per-signal env over shared env, options over
both), matching what the exporters do; exact `toEqual` tests. Drift recorded in plan.md.

### S1-S6 [SUGGESTION]
- S1 second-start warning repeated → Fix now (applied): warns once.
- S2 export failures silent → Fix now (applied): OpenTelemetry diag errors go to the console (export errors carry the
  response, not the request headers); `diag.disable()` in the test reset.
- S3 malformed config stops Next start-up, undocumented → Fix now (applied): documented as deliberate.
- S4 start line said `unknown_service`, `isExporting` stayed true after shutdown → Fix now (applied).
- S5 a message with a line break could forge console lines → Fix now (applied): escaped; test.
- S6 test isolation (`OTEL_*` cleared in next tests, fetch body read before flush) → Fix now (applied).

## Triage summary
Fixed: W1, W2, W3, W4, S1-S6. Accepted: -. Deferred: -. Dismissed: -.

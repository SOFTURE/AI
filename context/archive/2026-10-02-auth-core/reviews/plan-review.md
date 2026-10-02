# Plan review: auth-core

Reviewed: plan.md @ 2026-10-02 (author's review, `--auto`). Verdict: approve after fixes.
Findings: 0 critical, 2 warning, 2 suggestion.

## Findings

### W1 [WARNING] The guard's redirect would use the request's host
**Where:** Phase 2, `createAuthGuard`
**Problem:** behind a proxy the request URL can carry an internal host; a redirect built from it
sends the browser to an unreachable address.
**Decision:** Fix now (applied to the plan) - the login URL is built on `config.appOrigin`; the
request contributes only its path and query (as `next`).

### W2 [WARNING] The login and register actions read the client key from headers the e2e must send
**Where:** Phase 3
**Problem:** the example app uses `cloudflareIp()`; a browser context without `cf-connecting-ip`
gets `security.client_unidentified` on every login.
**Decision:** Fix now (applied) - `auth.spec.ts` sets `extraHTTPHeaders` per test with a fresh
address, so buckets never leak between tests or reruns.

### S1 [SUGGESTION] Export the default buckets so an app does not copy numbers
**Decision:** Fix now (applied) - `AUTH_RATE_LIMIT_BUCKETS` in the plan's Goal.

### S2 [SUGGESTION] A protected-path prefix like `/account` must not match `/accounting`
**Decision:** Fix now (applied) - prefix matching on path segments, in the guard tests.

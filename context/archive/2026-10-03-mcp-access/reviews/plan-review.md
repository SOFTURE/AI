# Plan review: mcp-access

Reviewed: plan.md @ 2026-10-03 (author's review, `--auto`). Verdict: approve after fixes.
Findings: 0 critical, 3 warning, 1 suggestion.

## Findings

### W1 [WARNING] The limit check must not race
**Where:** Approach, Limit
**Problem:** FIRE counts the tokens and inserts in two statements outside a transaction; two parallel
issues can both see room and pass the limit together.
**Decision:** Fix now (applied) - count and insert run in one transaction under
`pg_advisory_xact_lock` per user; a test issues five tokens in parallel against a limit of two.

### W2 [WARNING] The SDK's expiry check runs on the wall clock
**Where:** Phase 1, endpoint
**Problem:** `requireBearerAuth` rejects a token whose `AuthInfo.expiresAt` lies before `Date.now()`.
Expiry would then be decided twice, once on the module's clock and once on the wall clock, and tests
with an injected clock would start failing once real time passes their tokens' expiry.
**Decision:** Fix now (applied) - the endpoint parses the Bearer header itself and answers refusals
with the SDK's `bearerAuthChallengeResponse`; expiry is decided only by the query on `ctx.clock`.

### W3 [WARNING] Writes must be off by default and switchable off at once
**Where:** Approach, Writes
**Problem:** storing the effective write flag at issue time would keep old write tokens writing after
the app turns `allowWrites` off.
**Decision:** Fix now (applied) - `canWrite` is `can_write && allowWrites` at every verification;
`allowWrites` defaults to `false`; a test flips it on a stored write token.

### S1 [SUGGESTION] Per-tool scopes
**Decision:** Defer - one write flag per token matches FIRE and the roadmap outcome; listed under
known gaps in the README.

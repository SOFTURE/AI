# Plan review: mcp-access-adoption-gaps

Reviewed: [plan.md](../plan.md) against change.md, issue #213, the mcp-access sources on master `88fc13c`, the
adopting app's OAuth layer, `@softure-ai/auth` (`requireUser`, `toSafeNextPath`), `@softure-ai/security`
(`consumeRateLimit` keys up to 200 characters) and the db adoption comparison. Effort: high (an authorization server
on a public surface, a migration, an adoption of live credentials).

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Critical | The adopter names an OAuth access token after its client, up to 80 characters, while `access_tokens.name` is checked at 1-60. The adoption migration would fail its `ADD CONSTRAINT` on live rows, or, done without the check, the comparison refuses. | Accepted: the module cuts client names to 60 at registration and checks `oauth_clients.client_name` the same way; the README's adoption SQL runs `left(btrim(name), 60)` on both tables before adding the checks. The adoption test seeds an 80-character client name. |
| 2 | Critical | The decision route is a cookie-authenticated `POST` that mints a code for the signed-in person. Comparing `Origin` with the `Host` header (as the adopter did) trusts a header a proxy may rewrite. | Accepted: `Origin` must equal `appOrigin`'s origin; a missing `Origin` is refused (403). The session cookie's `SameSite=Lax` stays the first layer. Tests: cross-origin, missing origin, same origin. |
| 3 | Warning | An enabled OAuth with no `mcp-oauth` bucket would fail on the first registration as a quiet 503. | Accepted: the bucket joins `MCP_RATE_LIMIT_BUCKETS` (apps spreading it get both), and the OAuth handlers assert it like the endpoint asserts `mcp`: thrown by name. |
| 4 | Warning | `legacyTokenPattern` runs on any `Authorization` header value; a pattern with nested quantifiers on a long header is a cheap denial of service. | Accepted: values over 512 characters are refused before the pattern runs; the README tells apps to keep the pattern a plain character class with a fixed length. |
| 5 | Warning | Login must bring the person back to the consent screen with every parameter (state, challenge, resource), or the flow is lost. | Checked: `requireUser({ next })` keeps paths up to 8192 characters with their query (`MAX_NEXT_PATH_LENGTH` was sized for this). The consent page passes the full `/oauth/authorize?…` path. |
| 6 | Warning | An app's proxy guard that protects everything but a list would redirect `/.well-known/*`, `/api/oauth/*` to login, and clients would see HTML instead of JSON. | Accepted: README §4 names the paths that must stay public (the consent page checks the session itself). |
| 7 | Warning | The adopter's client ids (`pm-…`) and refresh tokens (64 hex) differ from the module's shapes. | Accepted as planned: no check on `client_id`, refresh tokens and codes are looked up by hash with a length cap only. The adoption test refreshes a legacy refresh token. |
| 8 | Suggestion | Every refresh leaves the previous access token alive until it expires (an hour), and each refresh adds a row. | Accepted as planned: the grant's expired access tokens are deleted on each refresh, `pruneAccessTokens` deletes expired tokens of every kind, and a new `pruneOAuthRecords` deletes expired codes, expired grants and stale clients for a scheduled job. |
| 9 | Suggestion | `oauth.authorizationCodeLifetimeMinutes` above 10 goes against RFC 6749 §4.1.2. | Accepted: range 1-10. |

No open findings. Verdict: ready to implement.

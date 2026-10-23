---
change_id: connections-request-retry-663
status: archived
---

# Plan: request helper and forced refresh (issue #663)

Input: change.md, research.md. Complexity: small to medium (one package: tokens, a new request module, `/next`,
fake provider, docs).

## Phase 1: forced refresh (TDD)

Files: `modules/connections/src/server/tokens.ts`, `tests/tokens.test.ts`.

1. Tests first: `forceRefresh: true` refreshes a fresh token (one provider call, new token stored); overlapping
   forced calls refresh once; `invalid_grant` on a forced refresh is `reconnect_required` with the hook once; without
   a refresh token a forced call answers the stored token; a refused refresh is `refresh_failed`.
2. `GetAccessTokenInput.forceRefresh?: boolean`. `resolveToken` skips `isFresh` when forced, keeps the
   "credentials changed" reuse; `waitForRefresh` drops the force once another worker stored a new token.
3. Internal `replaceRejectedToken(ctx, { provider, accountId, rejectedToken })`: a forced refresh only while the
   stored access token is still the refused one (otherwise the stored token, already replaced, is answered).

## Phase 2: requestWithConnection and the fake API (TDD)

Files: `src/server/request.ts` (new), `src/server/index.ts`, `src/next/tokens.ts`, `src/next/index.ts`,
`src/testing/fake-provider.ts`, `tests/request.test.ts` (new), `tests/next.test.ts`.

1. Fake provider: `apiUrl` (`<origin>/api/me`) answers 200 `{ ok: true }` for a live access token and 401 otherwise;
   `rejectAccessTokens()` makes every issued access token invalid (an early revocation); `calls.api` counts calls;
   `failNext` stays for the token and revoke endpoints.
2. Tests first: OAuth 401 → one refresh, one retry, value returned, connection stays connected; second 401 →
   `reportCredentialRejected`, `connections.reconnect_required`, hook once with `rejected`; refresh `invalid_grant`
   → `reconnect_required`; refresh unavailable → `refresh_failed`, connection still connected; API key and Basic:
   header set, 401 → rejected without a retry; other failures (403, 500) pass through unchanged and report nothing;
   the caller's own `authorization` header is replaced; schema, method, body and `readHeaders` reach `requestJson`;
   credential failures before the call (`not_connected`, `unknown_provider`) come back as they are; overlapping 401s
   refresh once.
3. `requestWithConnection(ctx, account, options)` with the overloads of `requestJson`; `/next`
   `requestWithConnection(account, options)` with the app's context.

## Phase 3: docs

`modules/connections/README.md` (§4 "Using a connection" with the helper, §1 list, Testing section),
`modules/connections/CHANGELOG.md` `## Unreleased`, package description untouched unless needed.

## Decisions (auto)

- A rejected credential (second 401, or the first one for an API key or Basic) answers
  `connections.reconnect_required` instead of the raw 401: the connection is now terminal and a job handler reads the
  same code it gets from `getAccessToken`. Any other `requestJson` result is returned unchanged.
- Only a 401 triggers the refresh and the report; a 403 is a permission problem, not a dead credential.
- The retry is skipped (and the credential reported) when a forced refresh answers the same token (no refresh token).
- `replaceRejectedToken` is exported from `/server` too: an app with its own HTTP client gets the same
  "refresh once for the refused token" behaviour.
- (During implementation) a forced call on an OAuth token that never expires and has no refresh token answers the
  stored token; before, the no-refresh-token branch treated a null expiry as expired, which only a forced call can
  reach.
- The helper does not default the API `fetch` to `connections({ fetch })`, which is the token endpoint's fetch; the
  caller passes `fetch` like with `requestJson`.

## Progress

- [x] Phase 1: forced refresh, 2aeff78
- [x] Phase 2: requestWithConnection and the fake resource endpoint, c7478b0
- [x] Phase 3: docs, and the never-expiring token case, 5f2c4e9
- [x] Implementation review: approved

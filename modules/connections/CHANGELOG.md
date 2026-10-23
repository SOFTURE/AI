# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/connections`. When an app has run a
version in production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done").

## Unreleased

- The token and revocation calls go through core's `requestJson({ form, errorSchema })` (#677) instead of a copy of its
  rules. Codes and behaviour are unchanged: an OAuth error (`invalid_grant`, `invalid_client`) is read from a 2xx or
  4xx answer, a 429 or 5xx is a plain failure whatever its body says, and a redirect is never followed. Needs the
  `@softure-ai/core` release that carries `form` and `errorSchema` (the range is raised with it).
- The fake provider (`/testing`) reads a form body sent as `URLSearchParams` as well as its text.
- An `api_key` provider can say where its key goes (#675): `header: { name: "x-api-key" }` sends the bare key in that
  header, `header: { name: "authorization", scheme: "Token" }` sends `Authorization: Token <key>`. Without `header`
  nothing changes (`Authorization: Bearer <key>`). The name must be an HTTP token (it is stored lowercase), and
  `scheme` is allowed only with `authorization` (`Bearer` when omitted).
- `requestWithConnection` sends the key in that header and replaces the caller's header of the same name; the 401
  rule is unchanged, so a provider that reads `x-api-key` no longer refuses a Bearer header and marks a valid key
  `reconnect_required`.
- `getCredentialHeader(ctx, { provider, accountId? })` in `/server` and `getCredentialHeader({ provider, accountId? })`
  in `/next` answer `{ name, value }` for an app with its own HTTP client; `formatCredentialHeader(credential,
  placement?)` and `getCredentialPlacement(provider)` in `/server` do the same without a read. `getAuthorizationHeader`
  is unchanged.
- Migration for an app: optional. A client that hand-writes a custom key header with `getCredential` and repeats the
  401 handling can declare `header` on its provider and call `requestWithConnection` (or take the header from
  `getCredentialHeader`).

- `requestWithConnection` takes `requestJson`'s new `form` option (a `URLSearchParams` or a `FormData` with files)
  and sends it as it is, also on the retry after an OAuth refresh (#676). Needs the next `@softure-ai/core` release.

## 0.2.0

- `requestWithConnection(ctx, { provider, accountId? }, options)` in `/server`, and `requestWithConnection({ provider,
  accountId? }, options)` in `/next` with the app's context (#663): one API call with the stored credential of any
  kind. It sets the `Authorization` header, takes every option of `requestJson` and returns its result unchanged; on a
  401 with OAuth it refreshes once and retries once, and only a second 401 (or the first for an API key or Basic
  credential, or for OAuth without a refresh token) calls `reportCredentialRejected` and answers
  `connections.reconnect_required`. Credential failures come back as the `connections.*` codes.
- `getAccessToken(ctx, { provider, accountId?, forceRefresh: true })` refreshes now, under the row's lease, even when
  the token is not close to expiry (`invalid_grant` is terminal as before; without a refresh token the stored token is
  answered). `replaceRejectedToken(ctx, { provider, accountId?, rejectedToken })` refreshes only while the stored
  token is the refused one, so overlapping callers spend one refresh.
- `/testing`: the fake provider has a resource endpoint `fake.apiUrl` (401 for a token it does not accept),
  `fake.rejectAccessTokens()` (every issued access token refused early) and `fake.calls.api`.
- Migration for an app: optional. An API client that repeats `getAccessToken` (or `getCredential`),
  `getAuthorizationHeader`, `requestJson` and `reportCredentialRejected` on a 401 can be replaced by one
  `requestWithConnection` call with the same `requestJson` options (drop its own `authorization` header). Branch on
  `connections.reconnect_required` (terminal) versus `connections.refresh_failed` / `connections.refresh_in_progress`
  (retry later) as with `getAccessToken`.

## 0.1.1

- No change for an app: the code is that of 0.1.0. This is the first version published through the package's npm
  trusted publisher (OIDC, `release.yml`) with no token; 0.1.0 needed `NPM_TOKEN` as a new package.

## 0.1.0

- First version (#634): the app as an OAuth 2.0 client of third-party APIs and a store for their API keys and Basic
  credentials.
  - Providers from configuration (`connections({ providers })`): OAuth (authorize and token endpoints, scopes, client
    id and secret from environment variables, extra authorize parameters, PKCE, refresh-token rotation, an optional
    revocation endpoint and refresh-token lifetime), API key and Basic, each with one or more accounts.
  - Connect flow for Next.js: `startConnectionAction` (one-time state bound to the admin, PKCE verifier kept server
    side), `completeConnectionRoute` for the callback, and `ConnectionsPage` (admin-only) listing every account with
    its status (connected, expiring, needs reconnect, not connected), last refresh, granted scopes and last problem,
    with connect, reconnect, key and disconnect actions.
  - Tokens and keys sealed with AES-256-GCM under the `SOFTURE_CONNECTIONS_KEYS` keyring, the key id stored per row;
    `softure-connections key` prints a new key and `softure-connections rotate-keys [--commit]` re-seals.
  - `getAccessToken` refreshes under a lease (one refresh across workers), turns `invalid_grant` into the terminal
    `connections.reconnect_required` and other failures into retryable codes; `getCredential`,
    `reportCredentialRejected` and `getAuthorizationHeader` for keys.
  - `onReconnectRequired` hook, a privacy contributor, a health check, and `createFakeOAuthProvider` in `/testing`.

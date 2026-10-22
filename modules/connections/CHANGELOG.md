# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/connections`. When an app has run a
version in production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done").

## Unreleased

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

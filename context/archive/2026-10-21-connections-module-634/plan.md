---
change_id: connections-module-634
status: archived
---

# Plan: @softure-ai/connections (issue #634)

Input: change.md, research.md. Complexity: large (a new module: migration, server core, Next adapter, UI, CLI,
testing entry, docs). Package copied from `templates/package/`, shaped like `modules/feature-switches`.

## Phase 1: package, options, schema, migration

- `modules/connections/`: package.json (exports `.`, `./server`, `./next`, `./ui`, `./testing`, `./cli`; bin
  `softure-connections`), module.json, tsconfigs, CHANGELOG (`## Unreleased`), README (twelve sections).
- Module id `connections`, schema `connections`, depends on `auth ^0.2.0` (the page's role, the actor id).
- Options (`connections({ … })`, zod):
  - `providers`: discriminated union on `kind`:
    - `oauth`: `id`, `label`, `accounts` (default `["default"]`), `authorizeUrl`, `tokenUrl`, `revokeUrl?`,
      `scopes`, `scopeSeparator` (`" "`), `clientId` or `clientIdEnv`, `clientSecretEnv?` (none: a public client),
      `clientAuth` (`"body"` | `"basic"`, default `"body"`), `authorizeParams`, `pkce` (default true),
      `rotatesRefreshToken` (default false), `refreshTokenMaxAgeDays?`;
    - `api_key`: `id`, `label`, `accounts`, `hint?`;
    - `basic`: `id`, `label`, `accounts`, `hint?`.
  - `panelRole` (`admin`), `refreshSkewSeconds` (300), `expiringWithinHours` (72), `refreshLeaseSeconds` (30),
    `refreshWait` (`{ attempts: 20, intervalMs: 250 }`), `stateTtlMinutes` (10), `httpTimeoutMs` (10 000),
    `onReconnectRequired?` (function), `fetch?` (function, tests).
  - Startup refusals: duplicate provider ids, duplicate accounts, `http:` endpoints off localhost, both or neither of
    `clientId` / `clientIdEnv`.
- Migration 0001: `accounts` (id, provider, account_id, kind, status, key_id, credentials, token_type, scopes,
  expires_at, refresh_expires_at, connected_at, connected_by, refreshed_at, last_error, last_error_at, updated_at,
  lease_id, lease_until; unique (provider, account_id); checks on every enum and text length) and `oauth_states`
  (state_hash PK, provider, account_id, key_id, verifier, created_by, created_at, expires_at). Rollback comment.

## Phase 2: server core (TDD on PGlite)

- `server/crypto.ts`: keyring from `SOFTURE_CONNECTIONS_KEYS`, `sealSecret` / `openSecret` with AAD,
  `generateConnectionsKey`. Errors as codes (`connections.key_missing`, `connections.key_unknown`,
  `connections.key_invalid`); a broken ciphertext is `connections.secret_unreadable`.
- `server/token-client.ts`: form POST to a token or revoke endpoint, timeout, `redirect: "manual"`, JSON answer,
  OAuth error body (`error`) read on any status, 2xx-with-`error` too; failures as codes only.
- `server/flow.ts`: `startAuthorization` (state + PKCE verifier, stored hashed / sealed, returns the authorize URL),
  `completeAuthorization` (one-time state bound to the starting user, `error=access_denied` → `consent_denied`,
  code exchange, upsert of the connection), `saveCredential` (api_key / basic), `disconnect` (best-effort revoke).
- `server/tokens.ts`: `getAccessToken` (fresh → returns; else lease, re-read, refresh, store under the lease id;
  `invalid_grant` → terminal, hook fired once on the transition; others retryable), `getCredential` (api_key /
  basic), `reportCredentialRejected` (the app saw a 401), `listConnections` (statuses: connected, expiring,
  reconnect_required, not_connected), `reencryptConnections`.
- `server/privacy.ts`, `server/health.ts`.

## Phase 3: Next adapter, UI, CLI, testing entry

- `next/`: context, messages, `ConnectionsPage` (requireRole), actions (`startConnectionAction` → redirect to the
  provider, `saveCredentialAction`, `disconnectAction`), route `completeConnectionRoute` (`GET` callback → 303 to the
  page with `?connected=` or `?error=`), `getAccessToken` / `getCredential` for request code.
- `ui/ConnectionsPanel`: rows with status, last refresh, granted scopes, expiry, last error, and connect / reconnect /
  disconnect / save-key forms; copy from messages, ui classes only.
- `cli/`: `softure-connections key [id]` prints a new key; `rotate-keys [--commit]` re-encrypts (dry run default).
- `testing/`: `createFakeOAuthProvider()`: an in-memory authorization server with a `fetch`, `consent(url)`,
  `revoke`, failure injection, rotation, token expiry.

## Phase 4: docs and wiring

- README twelve sections, root README layout line, CHANGELOG `## Unreleased`.
- Tests: module/manifest, options refusals, table constraints, crypto, token client, flow, refresh (lease, two
  concurrent callers, invalid_grant, retryable failures, rotation, hook once), page action, callback route,
  privacy, CLI, architecture (no raw colours, no inline copy, ui classes only), messages.

## Decisions (auto)

- Start is a server action (Next's origin check comes for free) instead of a `POST` route handler that would need its
  own CSRF check; the callback is the one route handler (the provider redirects there with `GET`).
- State: 32 random bytes, stored as a sha256 hash, one-time, 10 minutes, bound to the admin who started it. Stronger
  than a signed stateless state (single use, nothing to replay), and the PKCE verifier stays server side, sealed.
- One keyring variable, first key encrypts: rotation without a deploy-time migration.
- Refresh lease column instead of a row lock across a network call.
- `clientAuth` defaults to `body` (accepted by the most providers); `basic` is one option away.
- No dependency on #635: token endpoints are form-encoded.
- API-key and Basic credentials are pasted on the page by the admin and stored like tokens; the app reports a 401
  with `reportCredentialRejected` to flip them to "needs reconnect".

## Progress

- [x] Phase 1: package, options, schema, migration
- [x] Phase 2: server core (crypto, token client, flow, tokens, credentials, list, rotate, privacy, health)
- [x] Phase 3: Next adapter, UI, CLI, testing entry
- [x] Phase 4: README, CHANGELOG, root README; module tests (122)
- [x] Gates: typecheck, lint, test, build

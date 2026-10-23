---
change_id: connections-request-retry-663
status: done
---

# Research: request helper and forced refresh (issue #663)

Sources: `modules/connections/src/server/tokens.ts`, `credentials.ts`, `next/tokens.ts`, `testing/fake-provider.ts`,
`foundation/core/src/http-json.ts`, the README §4 "Using a connection", the archived change
`context/archive/2026-10-21-connections-module-634/`.

## Findings

- `getAccessToken` → `resolveToken`: returns the stored token while `isFresh` (outside `refreshSkewSeconds`),
  otherwise takes the row's lease with a conditional `UPDATE` and refreshes; after the lease it re-checks
  `isFresh || credentials changed` to reuse a refresh another worker finished. `waitForRefresh` polls while another
  worker holds the lease and retries once. A forced refresh only needs the freshness check skipped; the
  "credentials changed" check must stay so a second caller reuses the first caller's new token.
- Without a refresh token, an unexpired token is answered as stored: a forced refresh cannot help there.
- `reportCredentialRejected` → `markReconnectRequired(reason: "rejected")`, runs the hook once, answers whether
  the status changed; it does not depend on the kind.
- `requestJson` (core) returns `core.http_refused` with `status: 401` for a 401 (also for 403 and 3xx), so the
  helper keys on `status === 401`. It has six overloads (schema or not, read or write, `readHeaders` or not); a
  wrapper keeps the typing only by repeating them. `new Headers(...)` throws a message that quotes an invalid value,
  so `requestJson` builds the headers inside its try; the wrapper must not build a `Headers` with the secret outside
  one (pass the headers on as a list of pairs instead).
- The fake provider tracks issued access tokens (`isAccessTokenValid`) but has no resource endpoint and no way to
  refuse a token early. `failNext` is consumed by any URL the fake's `fetch` receives.
- `/next` wraps server functions with `getConnectionsContext(getSoftureConfig())`.

## Risks

- Overlapping 401s: if each caller forces a refresh, N callers spend N refreshes (and with rotation, race on the
  refresh token under the lease, which is safe but wasteful). The helper should refresh only when the stored token
  is still the one the API refused.

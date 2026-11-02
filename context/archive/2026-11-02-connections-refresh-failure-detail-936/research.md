---
change_id: connections-refresh-failure-detail-936
---

# Research

Read on master 2f4bddb.

- `src/server/token-client.ts`: `requestTokens` already answers `oauth_error { error, status }` (4xx or a 2xx error
  body, status 200 for any 2xx) and `failed { status }` (null for a network failure or timeout, the status for a
  429, 5xx, redirect or unexpected body). The `error` value is validated `^[\x20-\x7e]{1,100}$`; the description is
  never read. So the detail exists and is dropped in `tokens.ts` `refreshUnderLease`.
- `src/server/tokens.ts`: `invalid_grant` → `markReconnectRequired` (`last_error = connections.reconnect_required`);
  `invalid_client`/`unauthorized_client` → `client_rejected`; anything else → `refresh_failed`; `recordFailure`
  stores the bare code. No log line on any of these.
- `last_error` has a CHECK constraint (`^[a-z][a-z0-9_-]*\.[a-z][a-z0-9_]*$`): the code format, read back by the page
  through `getConnectionsErrorMessage`. Writing the detail into it would break the constraint and the copy lookup,
  so the detail goes into two new columns (`last_error_http_status`, `last_error_oauth_error`), shown beside the
  translated code on the page.
- `Err<E>` of core carries only `error`; a richer failure is an interface extending it (the same pattern as core's
  `HttpJsonFailure` with `status`). `callWithConnection` returns the token failure as it is, so
  `requestWithConnection`/`downloadWithConnection` pass the detail on once `ConnectionRequestFailure` includes it.
- Writers of `last_error`: `tokens.ts` (recordFailure, success clears), `store.ts` (markReconnectRequired),
  `credentials.ts` and `flow.ts` (clear on save/connect). All must keep the new columns consistent.
- Migrations: `modules/connections/migrations/0001_*.sql`; a column add follows `mailing/0003` (rollback in the header).

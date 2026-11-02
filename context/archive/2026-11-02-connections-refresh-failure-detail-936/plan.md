---
change_id: connections-refresh-failure-detail-936
status: done
---

# Plan: the HTTP status and OAuth error code of a failed refresh (issue #936)

Input: change.md, research.md. Complexity: small (one package).

## Phase 1: result, log and storage (TDD)

Files: `migrations/0002_add_last_error_detail.sql`, `src/schema.ts`, `src/contract.ts`, `src/server/tokens.ts`,
`src/server/store.ts`, `src/server/request.ts`, `src/server/credentials.ts`, `src/server/flow.ts`,
`src/server/list.ts`, `src/index.ts` and `src/server/index.ts` exports, `tests/refresh-failure-936.test.ts`.

1. Migration 0002: `last_error_http_status integer CHECK (100..599)`, `last_error_oauth_error text CHECK
   (^[\x20-\x7e]{1,100}$)`, and a constraint that both are null when `last_error` is null.
2. `ConnectionsRefreshFailure extends Err<"connections.refresh_failed" | "connections.client_rejected">` with
   `status: number | null` and `oauthError: string | null`. `GetAccessTokenResult` and `ConnectionRequestFailure`
   answer it for those two codes.
3. `refreshUnderLease`: every failed refresh (including `invalid_grant`) logs one `console.warn` line:
   `@softure-ai/connections: token refresh failed provider=<id> account_id=<id> http_status=<n|null>
   oauth_error=<json|null> code=<code>`; `recordFailure` and `markReconnectRequired` (new optional `failure`) store the
   two columns; every other write of `last_error` clears them.
4. `ConnectionView` gains `lastErrorStatus` and `lastErrorOAuthError`.
5. Tests: a 400 `{"error":"invalid_request"}`, a 503 without a body, a network failure: the failure value, the log
   line and the stored columns; `invalid_grant` stores and logs its detail; a later success clears it; no token or
   body text in the log.

## Phase 2: the page and docs

1. `toConnectionPanelRows`: when the row has a detail, `details.lastErrorDetail` ("Last problem on {date}: {error}
   ({detail})") with the parts `details.httpStatus` ("HTTP {status}") and `details.oauthError` ("provider code
   {code}"); test in `tests/panel-rows.test.ts`.
2. README (failure shape, log line, migration), CHANGELOG `## Unreleased` with the migration step.

## Decisions (auto)

- Two new columns instead of packing the detail into `last_error`: its CHECK constraint and the copy lookup rely on
  the bare code.
- `client_rejected` carries the same detail as `refresh_failed`: both come from the same token-endpoint answer.
- `invalid_grant` keeps answering a plain `connections.reconnect_required` (other paths produce that code too), but
  logs and stores its detail.
- The OAuth code is logged JSON-quoted (it may contain spaces); the status as a number or `null`.
- Log level `warn` (a retryable failure), as the issue asks.
- The fields are `httpStatus` and `oauthError` (the issue said `status`): `requestWithConnection` returns token
  failures and `core.http_*` failures in one union, where `status` already means the provider API's own answer.

## Progress

- [x] Phase 1: result, log and storage, 247ddc3
- [x] Phase 2: the page and docs, 247ddc3
- [x] Implementation review: approved

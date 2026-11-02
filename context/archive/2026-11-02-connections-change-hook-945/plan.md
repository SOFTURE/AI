---
change_id: connections-change-hook-945
status: done
---

# Plan: a hook and a log line per connection change (issue #945)

Input: change.md, research.md. Complexity: small (one package, no migration).

## Phase 1: the event, the hook and the log line (TDD)

Files: `src/contract.ts`, `src/options.ts`, `src/index.ts`, `src/server/store.ts`, `src/server/flow.ts`,
`src/server/credentials.ts`, `src/next/actions.ts`, `tests/change-hook-945.test.ts`.

1. `ConnectionChangedEvent`, a discriminated union on `change`, all with `provider`, `accountId`, `kind`, `actorId`
   (string or null), `at`:
   - `connected` / `reconnected` (a row existed before);
   - `disconnected` with `revoked: boolean`;
   - `connect_failed` with `code: ConnectionsFlowErrorCode` (`kind` is `oauth`).
2. Option `onConnectionChanged(event, ctx)`, type `OnConnectionChangedHook`, exported.
3. `notifyConnectionChanged(ctx, event)` in `store.ts`: logs one info line
   `@softure-ai/connections: connection <change> provider=<id> account_id=<id> kind=<kind> actor_id=<id|null>`
   plus ` code=<code>` or ` revoked=<bool>`; then runs the hook, catching and logging a throw by kind.
4. `completeAuthorization`: `connected`/`reconnected` after `storeGrant` (which reports whether a row existed);
   `connect_failed` for every failure after the pending authorization is consumed. `state_invalid` has no event.
5. `saveCredential`: `connected`/`reconnected` after the upsert. Input validation failures (`credential_invalid`,
   `wrong_kind`, `unknown_provider`) are not changes and have no event.
6. `disconnect` takes an optional `actorId` (null when omitted, an operator script); `disconnected` after the delete
   and the revocation. `disconnectAction` passes the admin's id.
7. Tests: each change with the exact event and log line; reconnect after `reconnect_required`; a consent denied and a
   failed exchange give `connect_failed` with the provider; `state_invalid` gives none; a throwing hook is logged and
   the call still succeeds; no secret in any log line; the disconnect action passes the actor.

## Phase 2: docs

README (option table, section 10 hooks with the event shape and the log line), CHANGELOG `## Unreleased`.

## Decisions (auto)

- Both the hook and the log line, as the issue allows: the line gives every app an audit trail without code.
- A discriminated union instead of one shape with an optional `code`: `code` exists only on `connect_failed`,
  `revoked` only on `disconnected`.
- Key form validation failures are not `connect_failed`: nothing was attempted against a provider and nothing
  changed; the OAuth callback failures are, since the admin went through the provider.
- `reconnected` is decided by a read of the row before the upsert. A race between two admins connecting the same
  account at once can only mislabel connected/reconnected, never lose an event.
- Log level `info`; no option to turn it off (one line per admin action).

## Progress

- [x] Phase 1: the event, the hook and the log line, 55cf60b
- [x] Phase 2: docs, 55cf60b
- [x] Implementation review: approved

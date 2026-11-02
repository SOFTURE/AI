---
change_id: connections-change-hook-945
---

# Research

Read on master 18489c5.

- `src/server/store.ts` `markReconnectRequired`: the only hook today. It runs `onReconnectRequired` after the update,
  catches a throw and logs `@softure-ai/connections: the onReconnectRequired hook failed: <errorLogLabel>`. The new
  hook follows the same rule.
- `src/server/flow.ts` `completeAuthorization`: the pending authorization (provider, account) is deleted first; every
  failure after that point (`consent_denied`, `authorization_failed`, `exchange_failed`, `client_rejected`,
  `provider_not_configured`, key errors, and `unknown_provider`/`wrong_kind` for a provider removed from the
  configuration) knows the provider. `state_invalid` (no pending row) knows none. `storeGrant` upserts: a row that
  existed before (connected or `reconnect_required`) is a reconnect.
- `src/server/credentials.ts` `saveCredential` upserts the same way; `disconnect` deletes the row (returning it, so
  its kind is known) and takes no actor today; the `disconnectAction` in `src/next/actions.ts` has the admin's id.
- Callers: `src/next/actions.ts` (`saveCredentialAction`, `disconnectAction`) and `src/next/route.ts`
  (`completeConnectionRoute`) pass `getConnectionsContext(config)`; no CLI calls these functions.
- Logging in the package is `console.error`/`console.warn` with the `@softure-ai/connections:` prefix and
  `key=value` fields (PR #944 adds `provider=… account_id=…`). `console.info` is used the same way in `auth`.
- Options are a zod strict object; `onReconnectRequired` is a `z.custom` function. The new hook is added the same way.

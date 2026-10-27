---
change_id: connections-download-824
---

# Research

## What exists

- `modules/connections/src/server/request.ts`: `sendWithConnection` resolves the provider, reads the credential
  (`getCredential` or `getAccessToken`), replaces the credential header in the caller's headers (as pairs, so no
  `Headers` constructor throws a message quoting a secret outside the request's try), calls `requestJson`, and on a
  401 refreshes once with `replaceRejectedToken` and retries once (OAuth) or reports the credential rejected
  (`connections.reconnect_required`). The 401 check only reads `ok` and `status`, so it fits any result that carries
  them.
- `foundation/core/src/http-json.ts`: `requestJson` owns the timeout (`AbortSignal.timeout`, default 10 s, bounds
  the body too), `redirect: "manual"` (a redirect is `core.http_refused`, so a key never reaches another host), the
  status-to-code mapping (`getStatusFailureCode`), `Retry-After` parsing (`responseFailure`), the body rules
  (`getRequestBody`: JSON or form, binary bodies refused) and the rule that a caught error's message is never read.
  None of this is exported apart from `requestJson`; a binary reader in connections would have to copy it, which is
  the duplication the issue complains about.
- `coreMessages.en.errors` has copy for every `core.http_*` code; a new code needs copy there.
- Precedent: connections 0.3.0 relied on a core change (`form`, `errorSchema`) and the release raised the core range.

## Options

1. Read the body in connections with its own copy of the status mapping. Rejected: a second copy of core's rules.
2. Add `requestBytes` to core next to `requestJson`, sharing its helpers, and make `downloadWithConnection` wrap it
   through the same credential path as `requestWithConnection`. Chosen: one source for the HTTP rules, and an app
   without connections gets a safe binary download too.

## Size cap

`Content-Length` above the cap is refused before reading; otherwise the stream is read chunk by chunk and cancelled
as soon as the total passes the cap (a missing or lying `Content-Length` cannot make it buffer more). The refusal is
a new code, `core.http_too_large`, with the status: `core.http_unexpected_answer` would hide a condition the caller
can act on (raise the cap, or tell the user the file is too big).

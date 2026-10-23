---
change_id: connections-api-key-header-675
status: done
---

# Research: API key placement (issue #675)

Sources: `modules/connections/src/options.ts`, `src/server/credentials.ts`, `src/server/request.ts`,
`src/next/tokens.ts`, `src/contract.ts`, the README §3 and §4, `tests/request.test.ts`, `tests/credentials.test.ts`,
`tests/module.test.ts`, the archived change `context/archive/2026-10-23-connections-request-retry-663/`.

## Findings

- `apiKeyProviderSchema` is a strict object (`kind`, `id`, `label`, `accounts`, `hint`): a new optional `header`
  key is additive, and an unknown key is refused today, so no existing config carries one.
- `getAuthorizationHeader(credential)` is a pure function over `StoredCredential` (or an OAuth token): it has no
  provider definition, so it cannot know a placement. Changing the `StoredCredential` shape that `getCredential`
  answers would break apps that compare it exactly (tests here do so with `toEqual`).
- `sendWithConnection` already looks up the provider definition (`findProvider`) before reading the credential, so
  the placement is at hand there.
- `withAuthorization` rebuilds the caller's headers as pairs and drops every `authorization` pair before adding its
  own; the same filter works for any header name, compared case-insensitively.
- `/next` wraps every server read with `getConnectionsContext(getSoftureConfig())`.
- Header names: RFC 9110 `token` = `1*tchar`, `tchar = "!" / "#" / "$" / "%" / "&" / "'" / "*" / "+" / "-" / "." /
  "^" / "_" / "`" / "|" / "~" / DIGIT / ALPHA`. An auth scheme is a token too.
- Existing marketing-kit ElevenLabs client hand-rolls `xi-api-key`; it does not use connections and stays as is.

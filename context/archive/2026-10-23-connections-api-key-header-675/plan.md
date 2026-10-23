---
change_id: connections-api-key-header-675
status: archived
---

# Plan: API key placement (issue #675)

Input: change.md, research.md. Complexity: small (one package: options, credentials, request, `/next`, docs).

## Phase 1: configuration and header helper (TDD)

Files: `modules/connections/src/options.ts`, `src/server/credentials.ts`, `src/server/index.ts`, `src/next/tokens.ts`,
`src/next/index.ts`, `src/index.ts` (types), `tests/module.test.ts`, `tests/credentials.test.ts`.

1. Tests first: `header: { name: "X-Vendor-ApiKey" }` parses to `{ name: "x-vendor-apikey", scheme: null }`;
   `{ name: "authorization" }` to scheme `Bearer`; `{ name: "authorization", scheme: "Token" }` kept; a name that is
   not a token, a scheme that is not a token, and a scheme with any other header are refused with a path; a provider
   without `header` parses as before.
2. `apiKeyProviderSchema.header`: optional strict object `{ name, scheme? }`, name lowercased; resolved placement
   `CredentialHeaderPlacement = { name: string; scheme: string | null }` via `getCredentialPlacement(provider)`.
3. `formatCredentialHeader(credential, placement?)` (pure): `{ name, value }`; api_key uses the placement (default
   `authorization` + `Bearer`), Basic and OAuth always `authorization`.
4. `getCredentialHeader(ctx, account)` in `/server` and `getCredentialHeader(account)` in `/next`: reads the stored
   credential and answers `Ok<{ name, value }>` or the `getCredential` failure.
5. `getAuthorizationHeader` unchanged.

## Phase 2: requestWithConnection (TDD)

Files: `src/server/request.ts`, `tests/request.test.ts`.

1. Tests first: a custom-header provider gets `x-vendor-apikey: <key>` and no `authorization` header; a caller's
   header of the same name (any case) is replaced while its own `authorization` header is kept; a `Token` scheme
   provider gets `Authorization: Token <key>`; a 401 still reports the credential rejected.
2. `withAuthorization` becomes `withCredentialHeader(options, { name, value })`.

## Phase 3: docs

README §3 (option row and example), §4 (`getCredentialHeader`), CHANGELOG `## Unreleased`.

## Decisions (auto)

- The placement lives in the provider definition, not in `StoredCredential`: `getCredential` keeps its exact shape
  and the new `getCredentialHeader` reads the definition itself, so an app never repeats the placement.
- `header: { name: "authorization" }` without a scheme means `Bearer`, the same as no `header`; a bare key in
  `Authorization` is not offered (no provider asked for it; an explicit `scheme` would be needed later).
- Header names are stored lowercased; HTTP header names are case-insensitive.
- `header` is offered only on `api_key`; Basic is always `Authorization: Basic`.

## Progress

- [x] Phase 1: c219933
- [x] Phase 2: 4e36320
- [x] Phase 3: 6b23eb1

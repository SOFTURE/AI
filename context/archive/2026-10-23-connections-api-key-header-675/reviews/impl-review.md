---
change_id: connections-api-key-header-675
verdict: approved
---

# Implementation review

Reviewed the diff of c219933..6b23eb1 against plan.md and change.md.

- Every plan step is in: `header: { name, scheme? }` on `api_key` providers (lowercased name, `Bearer` default for
  `authorization`, null scheme for a bare key), the token and "scheme only with authorization" checks with their
  config paths, `formatCredentialHeader`, `getCredentialPlacement`, `getCredentialHeader` in `/server` and `/next`,
  and `requestWithConnection` sending the provider's header.
- Compatibility: a provider without `header` parses to the same output as before (the defaults test is unchanged),
  `getCredential` and `getAuthorizationHeader` answer as before, Basic and OAuth always use `Authorization`.
- The helper replaces only the caller's header with the credential's name: a caller's own `authorization` header
  survives next to `x-vendor-apikey` (tested), which is what a provider with two headers needs.
- The 401 rule is unchanged and tested for a custom-header provider.
- Secrets: headers stay a list of pairs; no new error path quotes a key.
- Gates: typecheck clean, ESLint clean on the package, language gate clean, connections tests green.

Verdict: approved, no changes.

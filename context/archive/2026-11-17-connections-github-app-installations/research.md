# Research: connections-github-app-installations

- The module's flow (`server/flow.ts`, `server/tokens.ts`) stores one OAuth grant per provider account, admin only
  (`panelRole`), keyed by `(provider, account_id)` with a fixed list of accounts from configuration. A per-end-user
  installation does not fit that table, and needs no stored secret anyway: the installation id is public and a token is
  minted from the App's key on demand. Hence a separate, stateless entry rather than a new provider kind.
- GitHub (REST, API version 2022-11-28): the App authenticates with a JWT, RS256, `iat` backdated (clock drift), `exp`
  at most ten minutes after `iat`, `iss` the App id (or client id). `GET /app/installations/{id}`,
  `POST /app/installations/{id}/access_tokens` (`repository_ids`, `permissions`; one hour), `GET
  /installation/repositories` with the installation token, `GET /user/installations/{id}/repositories` with a user
  token (404 when the user cannot reach the installation), code exchange at `/login/oauth/access_token` (OAuth errors
  answered with status 200).
- The `installation_id` of the setup redirect is a query parameter: GitHub's docs warn it can be spoofed, so the user
  check is the security boundary, not the redirect.
- Keys: GitHub hands out PKCS#1 PEM; WebCrypto imports PKCS#8 only, so the PKCS#1 DER is wrapped (version 0,
  rsaEncryption with NULL parameters, OCTET STRING). Works the same in workerd and Node.
- `requestJson` (core) already gives timeout, `redirect: "manual"` and coded failures; a 404 is
  `core.http_unexpected_answer` with status 404, mapped to `not_found` by status.
- Tests reuse auth's `createFakeGithubProvider` for the user side (connections already depends on auth).

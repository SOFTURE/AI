# Research: connections-user-oauth

- `src/server/flow.ts` (`startAuthorization`, `completeAuthorization`) and `tokens.ts` (`getAccessToken`) work on
  `connections.accounts`, unique per (provider, account_id), behind `panelRole`: the app's own connections. A per-user
  grant has no place there (the admin page, the privacy contributor and key rotation all read that table as the app's).
- `src/server/token-client.ts` already does the token and RFC 7009 calls over core's `requestJson` (timeout, no
  redirect, OAuth error codes from 4xx and GitHub's 200); it only needs the endpoint and the client auth style, so it
  is reusable for user grants. Its schema drops unknown fields, so a provider's `account_id` is lost today.
- `src/server/crypto.ts` (`sealSecret` / `openSecret` with additional data, `readKeyring`) seals any secret; a user's
  grant needs a context bound to the user and the provider.
- `/github-app` (0.5.0) set the precedent: stateless calls, the app keeps per-user ids with its rows, Workers-safe.
- The adopting app's own client (Dropbox): state and PKCE on Web Crypto, state stored as hex sha256 (a database
  constraint `^[0-9a-f]{64}$`), refresh tokens that do not rotate, revocation by `POST /2/auth/token/revoke` with the
  bearer access token (not RFC 7009), `account_id` in the token answer.

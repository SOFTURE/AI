# Research: mcp-tokens-end-on-password-change

- `auth.users.password_changed_at` is set by `register`, `consumePasswordReset`, `changePassword`, the
  temporary-password script and, from auth 0.2.19, a provider link of an unverified account.
- mcp-access checks tokens in one place, `findValidToken` (MCP and API kinds). OAuth refresh rotates in
  `refreshMcpGrant` (conditional `UPDATE`), codes are burned in `exchangeAuthorizationCode`.
- Lists: `listAccessTokens` (hand-issued), `listOAuthGrants` (connected apps). Prune: `pruneAccessTokens`,
  `pruneOAuthRecords`; an OAuth access token goes with its grant by cascade.
- `mcp.access_tokens.user_id` references `auth.users(id)`, so an inner join never drops a live row.

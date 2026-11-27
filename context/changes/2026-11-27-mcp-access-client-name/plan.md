# Plan: mcp-access-client-name

## Approach
- `McpServerIdentity` gains `readonly via?: McpClientVia` (`"oauth" | "token" | "stdio"`, exported type) and
  `readonly clientName?: string`, documented as always set by `createMcpRoute`/`createMcpEndpoint`.
- `findValidToken` selects `accessTokens.name`; `VerifiedAccessToken` gains `clientName` (the token's name) and `via`
  (`"oauth"` when `grantId` is set, else `"token"`).
- `authenticate` carries both in `AuthInfo.extra`; `readIdentity` puts them on the identity (a missing or malformed
  value leaves the field out rather than throwing: only the user id guards the account scope).
- The stdio entry sets `via: "stdio"` and `clientName: "stdio"`.
- README: the identity fields, and the `onToolCall` example takes `clientName` from the identity instead of
  `findTokenClientName` (kept, not deprecated). CHANGELOG `## Unreleased`.

## Phases
### Phase 1: client name on the identity (TDD)
- Tests first (red): `tests/endpoint.test.ts` asserts the factory gets `via: "token", clientName: "Laptop"` for a
  hand-issued token and `via: "oauth", clientName: <client name>` for an OAuth access token (a 70-character name is cut
  to 60); `tests/adoption-gaps-315.test.ts` asserts the stdio identity carries `via: "stdio", clientName: "stdio"`.
- Code, README, CHANGELOG.
- Done when: `npx vitest run modules/mcp-access modules/agent-ready` passes, typecheck, lint (with the language gate)
  and build pass.

## Decisions (auto)
- Optional fields in the type (research, option 2): no identity built outside the endpoint breaks, agent-ready keeps
  fitting an app's factory, and the release stays inside dependents' ranges.
- A third `via` value, `"stdio"`, for the local stdio entry: it authenticates by neither OAuth nor a token, and
  claiming either would mislead a record of who wrote. Its `clientName` is `"stdio"`.
- The name comes from the token row, not from `oauthClients`: grant tokens are stored under the client's cleaned name
  (1-60 characters), the same value `OAuthGrantView.clientName` shows, so no join and no extra query.
- Release: a patch (0.7.10). A minor (0.8.0) would fall outside agent-ready's `^0.7.0` range.

## Progress
- [ ] Phase 1: client name on the identity (TDD)

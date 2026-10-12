---
change_id: mcp-access-issue-token-386
---

# Research: mcp-access issueToken gaps (issue #386)

## Where things are

- `modules/mcp-access/src/next/issue-token.ts`: `issueToken(previous, form, { beforeIssue })`. Calls the gate,
  returns `{ status: "error", error: gate.error }` on refusal; a thrown error goes through `safeError` and becomes
  `core.unexpected` / `core.database_failed`. Builds `setup` with `getMcpAccessOptions(config).serverName` and
  `expiresText` with `formatDate`. `issued.expiresAt` (a `Date`) is at hand from `issueAccessToken`.
- `src/contract.ts`: `McpIssueRefusalCode`, `IssueTokenFormState` (error branch carries only a code), `IssuedToken`
  (`expiresText` only), `McpClientSetup.serverName`.
- `src/options.ts`: `mcpAccessOptionsSchema` with `serverName` (`SERVER_NAME_PATTERN`). The only consumer of the name
  for client setup is `issue-token.ts` (`getMcpClientSetup`); `oauth-http.ts` uses `serverName` for `resource_name`,
  a server-side identity that stays as is.
- `src/client-setup.ts`: `getMcpClientSetup({ serverName, ... })` puts the name in the Claude Code command, both JSON
  configs and the assistant prompt (`{serverName}` placeholder).
- `src/ui/token-manager.tsx:188`: the issue form shows `getTokenErrorMessage(messages, state.error)`.
- `foundation/core/src/safe-error.ts`: `PublicError`, `isPublicError` (brand survives two copies of core),
  `getPublicMessage`.
- Tests: `tests/adoption-gaps-315-next.test.ts` stubs Next's request scope and drives `issueToken` against PGlite;
  the new test follows it.

## Findings

- The setup name must stay a valid shell word and JSON key: reuse `SERVER_NAME_PATTERN` for `clientServerName`.
- The gate type is `Err<McpIssueRefusalCode>`; widening it to `Err<McpIssueRefusalCode | McpIssueRefusal>` (an object
  `{ code, message }`) is additive for existing gates.
- The thrown-error path logs `errorLogLabel(error)`; a `PublicError` is a deliberate refusal, so it is not logged as a
  failure.
- `expiresAt` as an ISO string keeps the form state plain JSON.

## Risks

- A refusal message must not be empty: an empty string would render no error at all. Fall back to the code's copy when
  the message is blank.

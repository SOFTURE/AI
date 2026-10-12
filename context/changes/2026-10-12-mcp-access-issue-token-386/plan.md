---
change_id: mcp-access-issue-token-386
status: active
---

# Plan: mcp-access issueToken gaps (issue #386)

Input: change.md, research.md. Complexity: small (three additive options in one action, one test file, docs).

## Phase 1: options, gate refusal text, expiresAt (TDD)

Files: `modules/mcp-access/src/options.ts`, `contract.ts`, `next/issue-token.ts`, `ui/token-manager.tsx`,
`index.ts` / `next/index.ts` exports; test `modules/mcp-access/tests/adoption-gaps-386.test.ts`.

1. Tests first, red on master:
   - With `clientServerName: "acme-app"`, `issued.setup` uses it in `claudeCodeCommand`, `jsonConfig`, `desktopConfig`
     and `assistantPrompt`; without it, `serverName` (unchanged output).
   - An invalid `clientServerName` (spaces, quotes) is refused by the options schema.
   - `beforeIssue: () => err({ code: "mcp-access.write_refused", message: "Your trial ended." })` gives
     `{ status: "error", error: "mcp-access.write_refused", message: "Your trial ended." }` and issues nothing.
   - A thrown `PublicError("Account is read-only.")` gives `{ status: "error", error: "mcp-access.issue_refused",
     message: "Account is read-only." }`, nothing logged as failure; a plain `Error` still gives `core.unexpected`
     with no message.
   - A blank message falls back to the code alone.
   - `issued.expiresAt` equals the stored token's `expiresAt.toISOString()`.
   - `TokenManager` renders the state's `message` instead of the code's copy.
2. Implement: `clientServerName` in the schema (optional, `SERVER_NAME_PATTERN`); `McpIssueRefusal` type and the
   widened `BeforeIssueGate`; `message?` on the error branch of `IssueTokenFormState`; `expiresAt` on `IssuedToken`;
   `issueToken` resolves them; `TokenManager` prefers `state.message`.

## Phase 2: docs

`modules/mcp-access/README.md` (option row, gate section with both refusal forms, `expiresAt`),
`modules/mcp-access/CHANGELOG.md` (`## Unreleased`).

## Progress

- [ ] Phase 1: options, gate refusal text, expiresAt
- [ ] Phase 2: docs

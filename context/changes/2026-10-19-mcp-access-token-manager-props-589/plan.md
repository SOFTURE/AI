---
change_id: mcp-access-token-manager-props-589
status: in_progress
---

# Plan: export the TokenManager prop builder (issue #589)

Input: change.md, research.md. Complexity: small (one moved function, one export, tests, docs).

## Phase 1: the builder (TDD)

Files: `modules/mcp-access/src/next/token-manager-props.ts` (new), `src/next/pages.tsx`, `src/next/index.ts`,
`tests/token-manager-props-589.test.ts` (new).

1. Tests first, with `/next`'s request scope mocked as in `adoption-gaps-315-next.test.ts`:
   - a user with one read token and one write token (writes allowed): rows carry name, scope text, status text,
     created/expiry/last-use lines formatted in the config's locale and zone; `tools`, `allowWrites`, `maxTokens`,
     `messages`, `locale` equal the config's;
   - an expired token reads `expired` and `isExpired: true`;
   - with OAuth off there is no `grants` key; with OAuth on, a connected client is listed;
   - another user's tokens are not returned.
2. Move `describeStatus`, `toRow`, `toGrant`, `toTool` into `token-manager-props.ts` with
   `getTokenManagerProps({ userId, config? }): Promise<TokenManagerData>`; `TokenManagerData` is the `Pick` of
   `TokenManagerProps` data keys.
3. `McpAccessPage` spreads `getTokenManagerProps({ userId: user.id, config })` and adds the actions.
4. Export the function and its types from `src/next/index.ts`.

## Phase 2: docs

`modules/mcp-access/README.md` (an app's own page around `TokenManager`), `CHANGELOG.md` `## Unreleased` with the
migration (drop the local copies of the builders).

## Progress

- [x] Phase 1: the builder (4 tests written first; 33 mcp-access and repo test files pass; 4ff495c)
- [x] Phase 2: docs (README `getTokenManagerProps` with a page example, CHANGELOG `## Unreleased` with the migration)

---
change_id: mcp-access-token-manager-props-589
---

# Research: mcp-access-token-manager-props-589

Sources: `modules/mcp-access/src/next/pages.tsx` (`McpAccessPage`, `toRow`, `toGrant`, `toTool`, `describeStatus`),
`src/next/format.ts`, `src/next/index.ts`, `src/next/context.ts`, `src/ui/token-manager.tsx` (`TokenManagerProps`),
`src/token-status.ts`, `foundation/ui/src/ui/card.tsx` (`CardHeadingLevel`), tests `adoption-gaps-315-next.test.ts`
(how `/next` is tested), `tests/support.ts` (`createTestMcp`, `createUser`).

- All four builders are private to `pages.tsx` and take `(config, options, messages)` plus `now` for rows. `now`
  comes from `ctx.clock.now()`, so the test clock makes dates and statuses exact.
- `McpAccessPage` reads tokens with `listAccessTokens(ctx, user.id)` and grants with `listOAuthGrants` only while
  `options.oauth.enabled`; `TokenManager` shows the connected apps section only when `grants` is given.
- `Card`'s `headingLevel` is `2 | 3 | 4`: an `h1` title is not available in `@softure-ai/ui` 0.3.x.
- `/next` tests mock `@softure-ai/core/next` (`getSoftureConfig`), `@softure-ai/auth/next` and `getConfiguredDatabase`
  so the module context runs on the PGlite test database.

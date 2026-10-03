# Plan: mcp-access

Input: change.md, research.md. Complexity: medium (2 phases).

## Goal

`@softure-ai/mcp-access`:

- `mcpAccess({ serverName, tools, allowWrites, tokenLifetimeDays, maxTokensPerUser, routes })`,
  validated; `MCP_RATE_LIMIT_BUCKETS` to spread into `security({ buckets })`;
- table `mcp.access_tokens(id, user_id → auth.users, name, token_hash, can_write, created_at,
  expires_at, last_used_at)` (migration `0001_create_access_tokens.sql`), Drizzle table, health check;
- `/server`: `issueAccessToken` (limit under an advisory lock), `listAccessTokens`,
  `revokeAccessToken`, `verifyAccessToken`, `pruneAccessTokens`, `handleMcpRequest` (rate limit →
  Bearer → factory), `getAccessTokenStatus`, `getMcpClientSetup`;
- `/next`: `createMcpRoute({ createServer })`, `McpAccessPage` (`requireUser`), `issueTokenAction`,
  `revokeTokenAction`;
- `/ui`: `TokenManager` (issue form, issued token with setup snippets, token list, tool catalog);
- messages en + pl; README (12 sections).

The example app enables the module with a demo MCP server over its guestbook (a read tool and a
write tool), mounts the page at `/account/mcp` and the endpoint at `/api/mcp`, and
`e2e/mcp-access.spec.ts` issues a token in the UI, calls the tools through the endpoint, and checks
revocation and scopes. `e2e/migrations.spec.ts` lists `mcp-access 1 create_access_tokens`.

**Out of scope:** OAuth for MCP, per-tool scopes, token renewal, an admin view of all tokens.

## Approach

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| SDK | peer `@modelcontextprotocol/server` `^2.0.0` | one copy shared with the app's factory | research 1 |
| Factory | `createMcpRoute({ createServer })` in the route file | keeps the SDK out of the config | research |
| Catalog | `tools` in options with per-locale copy | the page needs no MCP server | research 3 |
| Writes | `allowWrites && can_write`, at verification | one flag turns every write token off | research |
| Limit | count + insert in one transaction under an advisory lock | parallel issues cannot overshoot | research |
| Endpoint order | client id → rate limit → Bearer → body limit → factory | refuse floods before any lookup | FIRE route |

Rejected: storing the plaintext or a reversible form (a database leak would leak access); bcrypt or
scrypt for tokens (32 random bytes need no stretching, and a slow hash would be a denial-of-service
lever on a public endpoint); OAuth now (no client needs it for a personal token).

## Phase 1: Package, table, server functions and endpoint

**Discipline:** TDD (expiry, revocation, scope and limits are the risk).

- `package.json`, `tsconfig*.json`, `module.json`, lockfile; `migrations/0001_create_access_tokens.sql`,
  `src/schema.ts`, `src/options.ts`, `src/index.ts`, `src/contract.ts`, messages en + pl.
- `src/server/`: tokens, verification, endpoint handler, status, client setup, health.
- Tests on PGlite: options, issue/list/revoke, limit, expiry, last use, verification, endpoint
  (rate limit, 401, scopes, write gating with a demo server), table constraints, health, messages.

## Phase 2: Next adapter, page, example app and e2e

**Discipline:** test-after (wiring).

- `src/next/`: context, route factory, actions, page; `src/ui/token-manager.tsx` with a component test.
- Example: `softure.config.ts` (append `mcpAccess(...)` and its bucket), `lib/mcp-server.ts`,
  `app/api/mcp/route.ts`, `app/account/mcp/page.tsx`, messages, `package.json` dependencies, lockfile.
- `e2e/mcp-access.spec.ts`; `e2e/migrations.spec.ts` gains the new ledger row.
- README sections.

## Risks and rollback

- Rollback of the migration: `DROP TABLE mcp.access_tokens;` and the ledger row (in the SQL header).
- A leaked token: revocation is immediate (the row is deleted; the next request gets 401).

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Package, table, server functions and endpoint

#### Automated
- [x] 1.1 Server tests (issue, limit, list, revoke, expiry, last use, verification, endpoint, constraints, health) pass on PGlite — b1fa952
- [x] 1.2 `module.json` equals `toModuleJson(mcpAccess)` and the package passes `tests/repo/packages.test.ts` — b1fa952
- [x] 1.3 Gates green (typecheck, lint, test) — b1fa952

### Phase 2: Next adapter, page, example app and e2e

#### Automated
- [x] 2.1 `npm run e2e` passes against a local PostgreSQL 16, including `mcp-access.spec.ts` — e083f00
- [x] 2.2 Gates green (typecheck, lint, test, build) — e083f00

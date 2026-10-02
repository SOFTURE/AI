# @softure-ai/mcp-access

**Status:** wave 2 · not implemented · depends on: core, db, ui, security, auth

Access tokens for MCP clients (only the sha256 is stored, plus name, `can_write`, expiry,
`last_used_at`, a per-account limit), a `POST /api/mcp` endpoint (rate limit → Bearer → `mcp:read`/`mcp:write`),
a token management UI and client setup instructions (Claude Code, Desktop, deep links).
**The application provides** `createServer({ userId, canWrite })` and the tool catalog shown in the UI.
Writes need two consents: the `allowWrites` flag and a token with write access.

**Tables:** `mcp.access_tokens`

**Source in FIRE_TRACKER:** `src/db/access-tokens.ts`, `src/lib/{mcp-auth,access-token-status,mcp-client-config}.ts`,
`src/app/api/mcp/route.ts`, `src/app/actions/{manage-tokens,tokens,tokens-contract}.ts`,
`src/components/{token-manager,token-list,token-issue-form,issued-token,assistant-capabilities}.tsx`, `src/app/(app)/mcp/`.
The domain-specific `mcp/server.ts` and `mcp/tools.ts` are not extracted.

# Plan: mcp-access-api-tokens-961

## Approach
1. **Options**: `apiTokens: { prefix = "sftapi_", scopes: [{ name, access: "read" | "write", description }], examples }`
   (optional; absent, the API kind is off). Scope names `segment(:segment)*`, never `mcp:`; prefix lowercase plus `_`,
   never one of the module's `sftmc*` prefixes. `examples`: app copy per locale with `{token}` and `{appOrigin}`
   placeholders (a Shortcut or curl recipe) shown with the one-time reveal.
2. **Migration 0004**: `kind text NOT NULL DEFAULT 'mcp'` and `scopes text[] NOT NULL DEFAULT '{}'` on
   `mcp.access_tokens`, one check: an `mcp` row has no scopes; an `api` row has 1 to 32 scopes and no grant.
3. **Token layer** (`src/server/tokens.ts`, new `src/server/api-tokens.ts`): a shared insert under the existing lock
   and limit (both kinds count toward `maxTokensPerUser`), a shared lookup by hash and kind. `verifyAccessToken` finds
   `mcp` rows only; `issueApiToken`, `verifyApiToken` find `api` rows only. Write scopes are granted only with
   `allowWrites` and effective only while `isWritingEnabled`. `listAccessTokens` returns `kind` and `scopes`.
4. **`requireApiToken(ctx, request, { scopes })`** → `Ok<{ userId, tokenId, scopes }>` or a refusal value: client
   unidentified (400), `api` bucket per address before the lookup and `api-token` bucket per token after it (429 with
   `retryAfterSeconds`), missing or invalid Bearer (401), a missing scope (403), a write scope while writes are off
   (403), a failed count or lookup (503, logged). `apiTokenErrorResponse(refusal)` turns it into a JSON `Response`
   with `WWW-Authenticate`, `Retry-After` and `no-store`. Buckets in `API_TOKEN_RATE_LIMIT_BUCKETS` (root export).
5. **Entry point `@softure-ai/mcp-access/tokens`**: the API token functions, list/revoke/prune; a test walks its
   import graph and finds no `@modelcontextprotocol/*`.
6. **Token page**: when `apiTokens` is set, the form offers the kind (MCP / HTTP API) and, for API, the app's scopes
   as checkboxes; the reveal for an API token shows the token, the header and the app's examples; the list shows each
   token's kind and scopes; a section lists the app's scopes. The issue action answers an API token with a new form
   state `api-ok` (`IssuedApiTokenView`); `ok` and `IssuedToken` stay the MCP shape. The gate input gets `kind` and
   `scopes`.
7. **Privacy and prune**: the export lists `kind` and `scopes`; prune and delete already cover every row (tested).
8. Tests, README section "Tokens for HTTP routes", CHANGELOG `Unreleased` with the migration notes.

## Decisions (auto)
- D1 Option 2 of the research (a kind inside `mcp-access`, `/tokens` entry without the MCP SDK) over a new package:
  no table move for adopting apps, the page lists both kinds by construction, far less code. The npm peer list stays
  (an app without MCP gets the SDK installed but never loads it through `/tokens`); a split package can follow if an
  app needs the install smaller.
- D2 One API kind with one app-chosen prefix (not a list of kinds): every acceptance point is met, and kinds can be
  added later without a migration (the column is text).
- D3 Two buckets: per address before the lookup (guessing), per token after it (the issue's per-token limit).
- D4 A new form state `api-ok` instead of turning `IssuedToken` into a union: apps that read `issued.setup` after
  `status === "ok"` keep compiling (found while implementing: the union broke the module's own tests and every app
  composing `TokenManager`). Minor bump at the next release (new options, migration).
- D5 Both kinds share `maxTokensPerUser`: one place for the owner, one number on the page.

## Progress
- [x] Phase 1: options, migration, schema, token layer, `requireApiToken`, `/tokens` entry (+ tests) (a19695d)
- [x] Phase 2: token page, privacy, README, changelog, gates (8440b65)

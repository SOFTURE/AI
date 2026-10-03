# Implementation review: mcp-access

Reviewed: `b1fa952`, `e083f00` against plan.md (author's review, `--auto`). Verdict: approve.
Findings: 0 critical, 0 warning, 3 suggestion. Gates: typecheck, lint, test (unit 89 in the module),
build, and `npm run e2e` against PostgreSQL 16 (38 passed, 4 of them `mcp-access.spec.ts`).

## Checked

- **Secrets:** the plaintext exists only in `issueAccessToken`'s result and the issue action's
  answer; the table holds the sha256 (`CHECK` on 64 hex), logs carry token ids only (tested).
- **Authentication:** unknown, revoked, expired and malformed tokens get one `401 invalid_token`
  (tested byte for byte); the shape is checked before any lookup; expiry is decided in SQL on the
  module clock, with the same boundary on the list.
- **Authorization:** the factory receives the verified owner per request (tested with two accounts
  in parallel); `canWrite` is `can_write && allowWrites` at every verification (tested by flipping
  the option); revoke is scoped by `(user_id, id)` and refuses non-uuid ids before the query.
- **Abuse:** the rate limit counts before verification, fails closed with 503 and no detail, refuses
  unidentified clients; bodies over 1 MiB get 413 before a server is built; the per-account limit
  holds under five parallel issues.
- **Standard:** module layout, `module.json` equal to the manifest, pl + en copy with no inline
  text, only ui classes, no `next/*` outside `src/next/`, README with twelve sections.

## Findings

### S1 [SUGGESTION] The SDK logs a warning whenever the handler is created
**Where:** `src/server/endpoint.ts`, `responseMode: "json"`
**Note:** `createMcpHandler` prints that JSON mode drops mid-call notifications, once per process
(and in `next build`). Expected; the README names the trade-off.
**Decision:** Accept.

### S2 [SUGGESTION] The issue and revoke actions have no rate limit of their own
**Where:** `src/next/actions.ts`
**Note:** both need a session, issuing is bounded by the per-account limit, and revoking only deletes
the caller's rows.
**Decision:** Accept; a bucket can be added if abuse shows up.

### S3 [SUGGESTION] Expired tokens of abandoned accounts stay until someone prunes them
**Where:** `src/server/tokens.ts`
**Note:** issuing deletes only the issuer's expired tokens; `pruneAccessTokens` exists for a
scheduled job, and an expired row grants nothing.
**Decision:** Accept; documented in the README.

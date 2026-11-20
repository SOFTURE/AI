# Security report

<!-- softure-quality-review format 1 -->

A read-only security review of `modules/security` (@softure-ai/security) at one commit (`@softure-ai/quality-review`). Each run replaces this
file; the format is documented in the package README, "Report format".

| Field | Value |
| --- | --- |
| Date | 2026-11-19T18:11:00Z |
| Commit | `594d16ebbf2d4d3fa87ce167df9cffe2d189092a` |
| Focus | security |
| Scope | `modules/security` (@softure-ai/security) |
| Model | claude-opus-5-5 |
| Cost | 0.7053 USD of a 15.00 USD budget |
| Tokens | input 24, output 6648, cache read 683147, cache write 87126 |
| Turns | 25 |
| Files read | 21 |
| Status | complete |
| Findings | 0 critical, 0 warning, 0 suggestion |
| Ignored | 0 |

No findings: the review found nothing to report at this commit.

## Coverage

| Scenario | Status | Files | Note |
| --- | --- | --- | --- |
| auth-session | no surface | `modules/security/src/index.ts`, `modules/security/src/server/identify.ts` | The package has no sign-in, session, cookie, password reset or email-change code; it only supplies rate-limit keys (identifyClient, subjectKey) that auth packages use. Grep over modules/security/src found no session or cookie handling. |
| oauth-flow | no surface | `modules/security/src/index.ts` | There is no authorization server, redirect URI, PKCE or client registration code in modules/security/src. The manifest declares no routes and no mounts. |
| token-scope | no surface | `modules/security/src/index.ts`, `modules/security/src/server/options.ts` | The package has no MCP tools, API routes or tokens (manifest routes {}, mount []). Its exports are library functions that the app calls from its own routes. |
| webhook-verification | traced | `modules/security/src/server/webhook.ts`, `modules/security/src/signed-request.ts`, `modules/security/src/server/webhook-deliveries.ts`, `modules/security/src/read-small-body.ts`, `modules/security/migrations/0002_create_webhook_deliveries.sql` | handleWebhook works in a fixed order: a streamed size cap, then an HMAC check over the raw bytes with a constant-time byte compare, then JSON and zod parsing, then the delivery id and the signed-body hash recorded with INSERT ON CONFLICT DO NOTHING in the same transaction as handle. Failures are logged by error kind only, and error bodies carry codes only. verifySignedRequest enforces a single timestamp within a 300 s window. Replays inside that window, and replays after the retention period, are documented limits that the eventTime option and the ledger address. |
| command-injection | no surface | `modules/security/src/server/guarded-request.ts` | modules/security/src has no child_process, exec, spawn, ssh or sudo. The only node: I/O is http/https/dns, used by the outbound guard. |
| ssrf | traced | `modules/security/src/server/guarded-request.ts`, `modules/security/src/server/public-address.ts`, `modules/security/src/server/guarded-get.ts`, `modules/security/src/server/guarded-page.ts`, `modules/security/src/server/guarded-download.ts`, `modules/security/src/readable-text.ts` | Followed sendGuardedRequest, fetchGuardedPage and downloadGuardedFile. The URL is checked for scheme, credentials, port and IP literal, and every redirect Location goes through the same check again. On Node each resolved address is checked inside the socket lookup with agent:false (no rebinding window); on Workers the addresses are checked before the request, as documented. isPublicAddress blocks RFC 6890 IPv4 ranges and allows only global unicast IPv6, minus special-purpose ranges, so metadata, mapped and NAT64 addresses are refused. Bodies are capped after decompression and one timeout covers the whole fetch. htmlToReadableText makes no network calls. |
| csrf | no surface | `modules/security/src/index.ts` | The package exposes no cookie-authenticated endpoints or server actions (manifest routes {}, mount []). handleWebhook authenticates by HMAC, not cookies. |
| rate-limit | traced | `modules/security/src/server/rate-limit.ts`, `modules/security/src/server/identify.ts`, `modules/security/src/client-ip.ts`, `modules/security/src/client-ip-env.ts`, `modules/security/src/options.ts`, `modules/security/migrations/0001_create_rate_limits.sql` | consumeRateLimit is an atomic INSERT ON CONFLICT DO UPDATE with a capped counter and parameterized SQL. identifyClient refuses unidentified clients by default. The client-IP resolvers trust only the edge-set header: a comma-joined header (a duplicate or a list) is refused; X-Forwarded-For is read from the right by a fixed hop count or a trusted-proxy CIDR list; edgeProofIp compares SHA-256 digests with timingSafeEqual. IPv6 is keyed by its /64. |
| secrets | traced | `modules/security/src/server/webhook.ts`, `modules/security/src/server/rate-limit.ts`, `modules/security/src/client-ip.ts`, `modules/security/src/signed-request.ts`, `modules/security/src/server/identify.ts` | The logs (webhook failure, cleanup failure) print errorLogLabel kinds only. Secrets are never put in error messages: the edge-proof error gives the secret's length, not its value. Subject keys are stored as SHA-256 prefixes. No secret values are committed in the package sources or migrations. |
| runtime-hardening | no surface | - | modules/security ships no Dockerfile, compose file, host config or CI workflow (Glob over modules/security/**). It is a library package. |

## Critical

None.

## Warnings

None.

## Suggestions

None.

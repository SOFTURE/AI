---
change_id: mcp-access-adoption-gaps
reviewed: 2026-10-07
verdict: approved
---

# Implementation review: mcp-access adoption gaps (#213)

Reviewed the whole diff on `claude/project-thread-5l5utj` against `plan.md` and the plan review's
nine accepted findings, then re-read the security-relevant paths adversarially.

## Issue points

| # | Point | Where | Proof |
| --- | --- | --- | --- |
| 1 | Legacy tokens without the prefix, opt-in | `legacyTokenPattern` (`src/options.ts`), `isAcceptedTokenShape` (`src/server/tokens.ts`) | `tests/tokens.test.ts` "tokens an app issued before adopting the module"; `tests/module.test.ts` option validation |
| 2 | OAuth 2.1 (401 with `resource_metadata`, metadata, DCR, authorize with PKCE and consent, token with rotation and replay detection, connected apps with cascade) | `src/server/oauth*.ts`, `src/next/oauth-*.ts`, `src/ui/consent-form.tsx`, `migrations/0002` | `tests/oauth.test.ts`, `tests/oauth-http.test.ts`, `tests/endpoint.test.ts`, `tests/token-manager.test.tsx`; e2e `mcp-oauth.spec.ts` (full flow on the built app) |
| 3 | Separate lifetimes (90 d, 1 h, 90 d, 10 min) | `oauth.*` options with defaults | `tests/module.test.ts` defaults and ranges; `tests/oauth.test.ts` expiry cases |
| 4 | Adopting an app's tables, `baseline: { "mcp-access": 2 }` | `adoption/move-app-tables.sql`, README §5, playbook step 3.1 | `tests/adoption.test.ts`: `adoptModule` finds no difference; a legacy token, an OAuth access token and a legacy refresh token work afterwards. Sabotage: removing one index from the script fails it with `missing in database: index mcp.access_tokens_grant_id_idx` |
| 5 | `allowWrites: process.env.X === "1"` in the README | README §3 | — |

## Plan review findings

All nine are in the code: client names cut to 60 (`cleanClientName`), same-origin decision with
`403` on a missing `Origin` (`isSameOrigin`), the `mcp-oauth` bucket assertion, the 512-character
cap before the legacy regex, the consent path through `requireUser({ next })`, public paths listed
in README §4, hash-only lookups for legacy client ids and refresh tokens, `pruneOAuthRecords` plus
deleting a grant's spent tokens on refresh, and the 1–10 range for the code lifetime.

## Adversarial pass

- **Code burned before checks.** `exchangeAuthorizationCode` returns `null` (does not throw) after
  the conditional `UPDATE`, so the transaction commits and a wrong verifier, client or redirect
  leaves a dead code. Sabotage seen red: dropping the reuse revoke fails `tests/oauth.test.ts`.
- **CSRF on the decision.** The decision route refuses a request whose `Origin` is not the
  `appOrigin` origin; sabotage seen red in `tests/oauth-http.test.ts`. The decision route is not
  rate-limited: it needs a session, and the session routes are limited by auth.
- **Open redirect.** Errors before the client and its redirect URI are confirmed render on the
  consent page (`show-error`), never a redirect; the back link is the person's click.
- **Grant tokens and the hand-issued list.** OAuth access tokens are filtered out of the token
  list, the per-user limit and the revoke action (`isNull(grant_id)`), so a connected app cannot be
  "revoked" half-way from the token list and does not eat the limit.
- **Adoption data.** The script keeps rows; names longer than 60 characters are cut, and codes the
  module could not verify (not an S256 challenge) are dropped. Codes live minutes, so a client
  in the middle of a consent starts again.

## Found and fixed during the review

- The example app needed `app/.well-known/**/*.ts` in its `tsconfig.json` include: TypeScript's
  `**` skips dot folders. README §4 now says so for adopting apps.
- README claimed the consent decision counts in `mcp-oauth`; it does not (it needs a session).
  Corrected to registrations and token requests.

## Gates

`npm run typecheck`, `npm run lint`, `npm test`, `npm run build`; example app: `tsc`, ESLint,
`softure migrate`, `next build`, Playwright 125/125.

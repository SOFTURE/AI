---
change_id: mcp-access-oauth-hosts
title: "mcp-access: OAuth URLs from the request's host, extra resource hosts, metadata extensions, context helper and OAuthClientRow (issue #234)"
status: archived
roadmap_item: null
issue: 234
branch: claude/mcp-access-oauth-hosts-rfrods
created: 2026-10-08
updated: 2026-10-08
archived_at: 2026-10-08
---

## Intent

Close every point of [issue #234](https://github.com/SOFTURE/AI/issues/234), so an adopting app can mount the package's
OAuth routes, consent page and endpoint instead of keeping its own on top of `/server`:

1. **Origins.** Every URL the OAuth layer builds (issuer, endpoints in the metadata, `resource`, `resource_metadata`
   in the endpoint's `401`, `iss` on redirects) and the `Origin` check of the consent decision come from the origins
   resolved for the request, not only from the fixed `config.appOrigin`:
   - an optional resolver of the app origin per request (image built once and served under another origin, a proxy
     whose `request.url` does not carry the public host), with a helper that reads it from `Host`;
   - extra public hosts (`resourceOrigins`) whose root protected resource metadata announces that host as `resource`
     (RFC 9728 §3.3), and whose origin the token endpoint and the authorization request accept as `resource`.
2. **Metadata extensions.** `oauth.metadata.authorizationServer` / `.protectedResource`: extra keys merged into the
   discovery documents (static or computed from the origins); generated keys win, except a `resource_name` of the app.
3. **Exports.** A public helper that builds the `{ db, clock, config }` context in `/server` (and the `/next` one
   exported), and the `OAuthClientRow` type from the package root and `/server`.

A reviewer checks `tests/oauth-http.test.ts` and `tests/endpoint.test.ts` (origins, metadata), `tests/module.test.ts`
(option validation), the README sections 3, 4 and 12, and the CHANGELOG entry.

## Context

Issue #234, filed while an adopting app moved onto `@softure-ai/mcp-access` 0.1.7. Work is tracked in GitHub Issues:
no roadmap item; the PR closes the issue. Released as mcp-access 0.1.8. The analytics module solved the same family
(#210) with a static `origins` list selected by `Host`; this change follows that shape for the extra hosts.

## Constraints

- Default behaviour unchanged: without the new options every URL is `config.appOrigin` as in 0.1.7.
- `Host` only selects among configured origins for the extra hosts; a resolver that trusts `Host` for the app origin
  is the app's explicit choice and the README says what the proxy must guarantee.
- Public functions keep their signatures (an optional trailing `origins` argument is added); 0.x allows breaking, but
  nothing here needs it.
- English-only code and docs; no copy changes.

## Process notes

- Research: skipped as a separate file. The issue names each gap and its code path; reading `server/oauth-http.ts`,
  `server/options.ts`, `server/endpoint.ts`, `next/oauth-routes.ts`, `next/oauth-page.tsx`, `next/context.ts`,
  `next/actions.ts`, the tests and the analytics origins (#210) answered every unknown; findings are in plan.md's
  "Today" section.
- Framing: skipped. Each point is an observed adoption gap with the fix the adopter proposed; the open choices
  (resolver shape, which generated keys an extension may replace) are settled in the plan.

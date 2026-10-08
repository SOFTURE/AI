# Implementation review: mcp-access-oauth-hosts

Reviewed: the branch diff against plan.md, change.md and issue #234.
Verdict: **approve after fixes** (all applied before the commit).

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | `issueTokenAction` resolved the request's origins after issuing the token: a resolver that throws would leave an issued token nobody received. | Fixed: the endpoint URL is resolved before `issueAccessToken`. |
| 2 | Warning | README §4 put a template literal inside inline code (nested backticks), which renders broken. | Fixed: the example is a fenced block. |
| 2a | Warning | The full suite failed in `tests/adoption.test.ts`: it pinned `--adopt` to `0.1.7`, so every version bump breaks it. | Fixed: the test reads the version from `package.json`. |
| 3 | Suggestion | The protected resource document now lists `resource_name` first (so an extension can replace it); key order changes for clients that compare text. | Accepted: JSON key order carries no meaning; tests compare objects. |
| 4 | Check | Defaults: every pre-existing OAuth and endpoint test passes unchanged; only the parsed-options snapshot in `module.test.ts` gained `resourceOrigins: []` and `oauth.metadata: {}`. | No change. |
| 5 | Check | Drift from plan: none. `McpOrigins`, `readRequestOrigin` and `findServedResourceOrigin` live in `src/origins.ts` (pure, so the root can export them) and `resolveMcpOrigins` in `src/server/origins.ts`; the plan named one file. | No change. |
| 6 | Check | Security: `Host` selects among configured `resourceOrigins` only; `readRequestOrigin` ignores an `X-Forwarded-Proto` other than http/https; a cross-site form still fails the `Origin` check because the browser's `Origin` and `Host` differ; the token endpoint never accepts an unlisted origin (`invalid_target` test). | No change. |
| 7 | Check | Tests: `tests/oauth-origins.test.ts` covers the resolver (discovery, `401`, register → decision → token on another port, consent validation), extra hosts (root document per host, accepted resources, token endpoint, option validation), caching headers, metadata extensions (static, computed, generated keys win, refused keys) and the context helper. | No change. |

Gates: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` (results in plan.md Progress).

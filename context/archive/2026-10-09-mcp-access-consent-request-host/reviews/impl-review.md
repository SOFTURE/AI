# Implementation review: mcp-access-consent-request-host

Reviewed: the branch diff against plan.md, change.md and issue #294.
Verdict: **approve** (one tightening applied before the commit).

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | The first draft compared only `new URL(Origin).host` with `Host`, so a value with a path or user info (`http://localhost:6510/x`, `http://evil@localhost:6510`) also passed. A browser never sends such an `Origin` and a non-browser sender holds no session cookie, but the check should accept exactly a serialized origin. | Fixed: the value must equal its own `new URL(...).origin` with an http(s) scheme; two refusal cases added to the test. |
| 2 | Check | Drift from plan: none. Decision 1 (app origin, else bare http(s) `Origin` whose host is `readRequestHost`) is implemented in `isSameOrigin`; no `X-Forwarded-Host` (test), no option, `iss` and `resource` still from `origins.appOrigin` (tests assert `iss` = the app origin on both configurations). | No change. |
| 3 | Check | Security: a cross-site `Origin` with the app's `Host` is refused, also with a matching `X-Forwarded-Host`; `null`, missing, malformed, `ftp:`, path and user-info values are refused. The check still runs before the body is read. DNS rebinding reaches the decision only without a session cookie (plan.md, Security). | No change. |
| 4 | Check | Tests were red on master: the two accepting tests answered `403` before the change; green after. Every pre-existing test passes unchanged, including the `oauth-origins` case that refuses the configured origin on a request served elsewhere under `readRequestOrigin`. | No change. |
| 5 | Check | Docs: README (decision route sentence, "Origins" paragraph), CHANGELOG `0.1.11`, version 0.1.11 in `package.json`, `module.json`, `src/index.ts` and `package-lock.json` (0.1.10 is on npm). | No change. |

Gates: see plan.md Progress.

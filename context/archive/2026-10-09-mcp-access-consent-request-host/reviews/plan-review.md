---
change_id: mcp-access-consent-request-host
reviewed: 2026-10-09
verdict: approved with fixes applied
---

# Plan review: mcp-access-consent-request-host

Checked plan.md against change.md, issue #294, `server/oauth-http.ts`, `origins.ts`, `server/origins.ts`,
`ui/consent-form.tsx`, `next/oauth-routes.ts` and the existing tests.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | The existing test in `oauth-origins.test.ts` that refuses `Origin` = the configured origin on a request served under `resolveAppOrigin: readRequestOrigin` must stay red-to-403 after the change. It does: its `Origin` host (`localhost:3000`) differs from `Host` (`localhost:6510`). | No change; the plan already says the existing tests stay unchanged. |
| 2 | Warning | The token step of the fixed-origin flow must name the app origin's endpoint as `resource`, since discovery on the served host advertises the fixed origin. A test that sent the served origin would fail for a reason unrelated to #294. | Accepted: the Phase 1 flow test sends `resource` = the app origin's endpoint and asserts `iss` = the app origin. |
| 3 | Suggestion | A `Host` with an explicit default port (`example.test:443`) does not match the `Origin` host `example.test`. Browsers never send it that way; the mismatch only refuses. | No change: conservative, and the app origin rule still applies. |
| 4 | Suggestion | Host-only matching accepts `https://h` for a request seen as `http://h` (TLS terminated at a proxy). That is the intended Next-like behaviour; a cross-site page cannot choose the host part. | No change; stated in decision 1. |
| 5 | Check | Security section: the cross-site form, DNS rebinding (no session cookie for the rebound name, so `userId` is null), `Origin: null`, missing and malformed `Origin` are covered, each with a test. | No change. |

No Critical findings. Research and framing skips are justified in change.md.

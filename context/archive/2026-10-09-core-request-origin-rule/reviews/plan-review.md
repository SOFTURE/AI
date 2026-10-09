---
change_id: core-request-origin-rule
reviewed: 2026-10-09
verdict: approved with fixes applied
---

# Plan review: core-request-origin-rule

Checked plan.md against change.md, issue #311, the four copies named there, the #294 change record and the tests
that pin each copy.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Critical | Reading `X-Forwarded-Host` in every module (the issue lists it as one of the differences) would let a spoofed header become the mcp-access issuer under `resolveAppOrigin: readRequestOrigin`, and break the #294 test that refuses an `Origin` matching only `X-Forwarded-Host`. | Accepted: decision 2, the forwarded host only picks among listed origins; `trustRequestHost` trusts `Host` only. |
| 2 | Warning | `resolveAppOrigin` now reads `X-Forwarded-Host` for discovery answers that are publicly cached; without it in `Vary` a CDN could serve one host's document under another. | Accepted: `Vary` gains `x-forwarded-host`. |
| 3 | Warning | `SoftureConfig.origins` becomes required in the type; configs built by hand in tests would stop compiling. | Accepted: `defineSoftureConfig` fills it; hand-built configs in the repository are fixed where typecheck names them. |
| 4 | Suggestion | auth's scheme rule accepted any `X-Forwarded-Proto` value; the core rule falls back to the URL's scheme for a non-http(s) value. The guard only redirects to listed origins, so the change can only send a visitor to `appOrigin` instead of a listed one. | No change; documented in the auth CHANGELOG. |
| 5 | Check | The per-module options keep working, so no adopter has to change config to upgrade. | No change. |

No open Critical findings.

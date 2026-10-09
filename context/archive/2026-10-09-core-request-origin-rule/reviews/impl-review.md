---
change_id: core-request-origin-rule
reviewed: 2026-10-09
verdict: approved
---

# Implementation review: core-request-origin-rule

Checked the diff against plan.md and change.md, re-read each module's call site, and ran the gates.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | auth: every existing guard test passes unchanged; the new test redirects to an origin listed only in `config.origins` and keeps `appOrigin` for an unlisted one. | No change. |
| 2 | Check | mcp-access: the #294 refusal of an `Origin` that matches only `X-Forwarded-Host` passes unchanged; under `trustRequestHost` a spoofed `X-Forwarded-Host` does not become the issuer (new test). | No change. |
| 3 | Check | agent-ready: a malformed `Host` still answers 500 with a named error (`readServedOrigin`); the directory signature uses the same helper. | No change. |
| 4 | Check | analytics: `readPublicOrigin` and `readOwnOrigin` keep their behaviour (a missing `Host` header still means no own origin); the config's trusted origins join the first-party list. | No change. |
| 5 | Warning | `Vary` gained `x-forwarded-host` on agent-ready and mcp-access discovery answers; the two tests pinning the value were updated with it, nothing else. | Accepted as planned (plan review #2). |
| 6 | Suggestion | `readForwardedProto` was added to core during implementation, so mcp-access and analytics do not keep their own `X-Forwarded-Proto` parsing. | Accepted; listed in the core CHANGELOG. |

Gates: `npm run typecheck`, `npm run lint`, `npm run build` green; the package tests of core, auth, agent-ready,
mcp-access and analytics green (77 files, 1058 tests); full `npm test` runs in the pre-push hook.

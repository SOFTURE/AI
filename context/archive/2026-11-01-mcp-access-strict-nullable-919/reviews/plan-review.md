---
change_id: mcp-access-strict-nullable-919
reviewed: 2026-11-01
verdict: approved
---

# Plan review: mcp-access-strict-nullable-919

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| F1 | WARNING | Overriding `optin` on a pipe must not change what an absent key parses to. | Planned: tests cover absent, null, default, prefault and optional fields against the original schema. |
| F2 | WARNING | The empty-schema tool changes the callback's call shape in the SDK. | Planned: the callback is wrapped to receive the context only; tested through `tools/call`. |
| F3 | SUGGESTION | A `default` around an object that holds a scalar still loses its listed default (zod drops it on any transforming node). | Out of scope: the issue names scalar fields; documented in the README. |

No open CRITICAL findings.

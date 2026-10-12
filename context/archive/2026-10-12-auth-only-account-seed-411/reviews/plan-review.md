---
change_id: auth-only-account-seed-411
reviewed: 2026-10-12
verdict: approved
---

# Plan review: auth-only-account-seed-411

Checked plan.md against change.md, research.md, issue #411 and `serve.ts`, `register.ts`, `ops-script.ts`.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | `registerUser` throws when the security buckets are missing (`assertAuthBuckets`); the seed must let that propagate as a failure with a readable line, not a stack trace. | Taken into Phase 2: catch, print `seed-account: failed: <message>`, exit 1. |
| 2 | Warning | `auth.registration_closed` when a switch closes registration: the seed should say so, since a dev database may have the switch off. | Taken into Phase 2 (refusal reason per code). |
| 3 | Warning | mcp-access published with `^0.1.0` would load an auth without the export. | Recorded under "Before the next release" in change.md. |
| 4 | Check | The resolver keeps "never the first of several" and the uuid check before the query (Postgres rejects a malformed uuid). | No change. |

No Critical findings.

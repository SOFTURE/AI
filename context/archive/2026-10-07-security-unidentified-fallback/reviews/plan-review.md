---
change_id: security-unidentified-fallback
reviewed: plan.md
date: 2026-10-07
verdict: approved with fixes applied
---

# Plan review: security-unidentified-fallback

Checked `plan.md` against `change.md`, the issue, `identifyClient`, the options schema and the modules whose
READMEs and tests configure `security(...)` (auth, mcp-access, waitlist, privacy, billing, blog, the example app).

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Warning | A fallback key that looks like a bucket name could be mistaken for one in the table. | Accepted: the client key is prefixed `unidentified:`, so a row says what it is and never collides with `ip:` or `subject:` keys. |
| 2 | Suggestion | The README chain for the test stack could read `X-Forwarded-For` behind the switch to key real clients instead of sharing one bucket. | Rejected for the documented example: the same chain in production keys by the Cloudflare edge (the issue's warning). The README names it as an option for a stack with no Cloudflare in front, next to the warning. |
| 3 | Suggestion | Other module READMEs (auth §3, mcp-access, waitlist) show `cloudflareIp()` only; none shows the old `NODE_ENV` chain. | No change needed: only the security README carries the pattern. |
| 4 | Suggestion | `subjectKey` keys are unaffected; the option only applies to `identifyClient`. | Recorded in the README function table. |

No finding blocks the plan.

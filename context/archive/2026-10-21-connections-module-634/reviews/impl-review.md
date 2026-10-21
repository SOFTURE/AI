---
change_id: connections-module-634
reviewed: 2026-10-21
verdict: approved
---

# Implementation review: connections-module-634

Checked the diff against plan.md, change.md and issue #634 (every bullet of "Ask").

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Major | Overlapping refreshes: the lease must be the only gate. | Conditional update on `lease_until`; the test with four overlapping callers sees one provider refresh, and fails when the lease condition is weakened (checked by mutating it). |
| 2 | Major | A secret must never reach a log, an error or a stored column in clear. | Token client keeps codes only (a thrown error quoting the URL and a provider's `error_description` are dropped, tested); `last_error` is a code with a database check; tests read the raw row and find neither token. The hook failure log carries the error kind only (tested with a message holding a secret). |
| 3 | Major | Callback CSRF and replay. | The state is consumed with `created_by = actor` and `expires_at > now` in one `DELETE … RETURNING`: another admin cannot use or burn it, a second use fails (tested). |
| 4 | Minor | `invalid_grant` must be terminal and the hook must not repeat. | Conditional update on `status = 'connected'`; tested: one provider call, one event, then the code without a call. |
| 5 | Minor | GitHub answers token errors with 200. | `error` is read on any status (`error_with_200` in the fake, tested). |
| 6 | Minor | A rotated refresh token stored after the lease ran out would overwrite another worker's. | Store is conditional on the lease id; the token is still answered and the case is logged and listed under README Limitations. Startup refuses a lease not longer than the HTTP timeout. |
| 7 | Minor | Status "expiring" must work for grants with and without refresh tokens. | Deadline = refresh token end (provider's `refresh_token_expires_in` or `refreshTokenMaxAgeDays`) or, without a refresh token, the access token end; tested both. |
| 8 | Check | Module standard: twelve README sections, module.json equal to the manifest, `en` only, ui classes only, no inline copy. | Repository tests and the module's architecture test pass. |
| 9 | Check | #635 is not needed: token endpoints are form-encoded. | The README shows `requestJson` for API calls with the token. |

No Critical findings.

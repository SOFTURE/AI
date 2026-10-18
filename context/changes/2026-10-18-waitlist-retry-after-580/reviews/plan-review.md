---
change_id: waitlist-retry-after-580
reviewed: 2026-10-18
verdict: approved
---

# Plan review: waitlist-retry-after-580

Checked plan.md against change.md, research.md, issue #580 and `actions.ts`, `contract.ts`, `waitlist-form.tsx`.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | The value comes straight from `RateLimitRejection`, so it equals the limiter's for both buckets; the acceptance test pins it with the fixed test clock. | No change. |
| 2 | Check | The field is optional and set only for `security.rate_limited`: other states, and apps that read the state, are unchanged (no breaking type change). | No change. |
| 3 | Major | An app with its own full translation (a non-English locale) gets the English `form.retryAfter` merged in until it adds the key. | CHANGELOG migration names the key; documented in README Copy. |
| 4 | Minor | Rounding: seconds under a minute must not show "0 min". | `getRetryMinutes` rounds up with a floor of 1; tested at 30 and 61. |
| 5 | Check | No secret or internal data reaches the client: the wait is already sent as `Retry-After` by security's HTTP helpers. | No change. |

No Critical findings.

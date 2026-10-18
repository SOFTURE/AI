---
change_id: waitlist-retry-after-580
reviewed: 2026-10-18
verdict: approved
---

# Implementation review: waitlist-retry-after-580

Reviewed: the branch diff against plan.md, change.md and issue #580.
Verdict: **approve**.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | Acceptance "`retryAfterSeconds` equals the limiter's value": `next-join.test.tsx` drives `joinWaitlistAction` over the client limit with the fixed test clock and gets exactly 900 for a 15-minute window, read straight from `RateLimitRejection`. | No change. |
| 2 | Check | Acceptance "other error states are unchanged": the same test pins `waitlist.email_invalid` with no `retryAfterSeconds`; the field is spread only for `security.rate_limited`. | No change. |
| 3 | Check | `WaitlistForm` formats `form.retryAfter` with minutes rounded up and at least 1 (tested at 30 and 61 seconds), honours an app override, and keeps `errors.security.rate_limited` without the value (existing test). | No change. |
| 4 | Check | `WaitlistFormState` change is additive (optional field), so apps that build or read states still compile. | No change. |
| 5 | Check | README and CHANGELOG `## Unreleased` describe the app migration, including adding `form.retryAfter` to an app's own translation; no version bump. | No change. |

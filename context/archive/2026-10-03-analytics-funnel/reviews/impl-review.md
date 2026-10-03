# Implementation review: analytics-funnel

Reviewed: the branch diff against plan.md (author's review, `--auto`). Gates: typecheck, lint, test
(1703 passed), build, and the example's e2e (65 passed, `analytics-funnel.spec.ts` included).
Verdict: approve. Findings: 0 critical, 1 warning (fixed), 2 suggestions (deferred).

### W1 [WARNING] `countRegistration` could still throw
`getChannel()` ran before the `try`, so a hook outside a request scope (`next/headers` unavailable) would
throw into auth's transaction and refuse the sign-up. **Fixed:** the channel is read inside the `try`.

### S1 [SUGGESTION] The tag is lost after the register action's redirect
Measured in e2e: after sign-up the account page opens at `/account` without `?z=`, so its beacon counts
without a channel. The proxy never sees a GET for the redirect target (Next renders it in the action's
response). **Decision:** deferred to the followups roadmap as FU-7 (`analytics-action-redirect-tag`); the
sign-up step itself is attributed; README §12 says so.

### S2 [SUGGESTION] Waitlist sign-ups cannot be counted
The waitlist has no hook, and the funnel reads no other module's table. **Decision:** FU-8
(`waitlist-funnel-hook`); README §12 says so.

Checked without findings: the beacon carries the step only; the channel comes from the page's Referer, never
from the request's own query; `server` steps are refused by the endpoint; bad input always answers 204 or the
GIF, 503 only on a database failure, `no-store` everywhere; the log line names the step and the error label,
not the channel or the query's parameters; parallel counts do not lose each other (unit test); a channel
counted before is never capped; the day follows `config.timezone` (unit test across midnight); the options
refuse a channel pattern that accepts the overflow key; the table checks the step's shape and a positive
count; migrations, ops and container expectations list the analytics module.

---
change_id: marketing-kit-provider-failure-1141
verdict: approved
---

# Plan review (auto)

- Scope matches the issue: structured fields for STT, isolation and music, retry only retryable failures, the
  structured failure in each range's outcome, safe to log.
- Compatibility: `providerFailure` is optional, `error` unchanged; the new `FootageFailure` kind is additive but
  breaks an exhaustive switch (0.x minor, CHANGELOG says so).
- Safety: `message` is the provider's own message truncated; the key never enters the failure.
- Risk: classifying a transient 4xx (e.g. 409) as not retryable; the issue sets the rule (only 408 and 429 among
  4xx) and the kit follows it.
- Approved.

# Plan review: stripe-sandbox-stabilize

Verdict: approved.

- The per-area `sharedPaths` keeps every other area's behaviour unchanged (tests cover all shared files).
- A manual, scheduled or unlisted run still reaches every area, so a skipped job never hides a red one for long.
- Risk: a billing dependency change (e.g. `@softure-ai/core`) no longer runs the Stripe job on its pull request; the
  nightly run bounds that to a day. Accepted.

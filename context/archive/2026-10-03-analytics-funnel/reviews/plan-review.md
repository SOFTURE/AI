# Plan review: analytics-funnel

Reviewed: plan.md against change.md, research.md and the roadmap item MO-5 (author's review, `--auto`).
Verdict: approve. Findings: 0 critical, 0 warning, 0 suggestions.

- Every outcome of MO-5 maps to a plan line: `analytics.funnel_counts` per (day, channel, step), steps from
  config, the daily cap with an overflow bucket, `sendBeacon` helper, POST beacon and GIF pixel with a body
  limit, the day in the configured time zone, a report function per channel.
- Both unknowns are answered in research.md §2: other modules' counts come in as `server` steps through hooks
  (no cross-schema reads), and old aggregates stay until the app prunes them (`pruneFunnelCounts`).
- One migration-adding item in group B (this one); MO-2 adds none.

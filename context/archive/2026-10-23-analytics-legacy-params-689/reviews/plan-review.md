---
change_id: analytics-legacy-params-689
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and the package on master (432f38a).

- Scope covers every ask of the issue: every reader named there (`readChannel`, `getChannelFromSearchParams`,
  `parseChannel` through `getChannelRule`, the keeper, `hasChannelParam`), the writers (`withChannel`, `tagPath`,
  the tagger, the keeper), the funnel wire and the validation limits.
- Compatibility: additive option; a single `channelField` keeps its meaning. The parsed type of `channelField`
  widens to a name or a list, which only matters to code reading `getAnalyticsOptions().funnel.wire`; note it in
  the CHANGELOG.
- Safety: a legacy name is read with the same pattern, length and normalization, so it opens no new input.
- Risk: the proxy reads `param` directly in two places; both must go through the shared helper, or a navigation from
  a page tagged `?z=` would be derived by `channelFromReferer` instead. Covered by a proxy test.
- Risk: the client component lists the rule's fields as effect dependencies; pass the legacy names as a joined string,
  as it does for `origins`.

Verdict: approved, no changes.

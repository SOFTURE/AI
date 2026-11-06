# Plan review: metering-footage-charge-rate-1130

Verdict: approved.

- Covers both asks of #1130 and the per-recorder attributes gap it names.
- No migration and no breaking change: old rows lack `reported: "true"` and are skipped by the rate read, so an
  app that recorded fallback amounts is not fed its own rate back.
- The numeric guard on `units` keeps a stray app attribute named `units` on an old row from breaking the cast.
- The containment filter on `reported` is served by the GIN index of migration 0002.

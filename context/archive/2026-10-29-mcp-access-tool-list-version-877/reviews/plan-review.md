---
change_id: mcp-access-tool-list-version-877
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and master (90e8bad).

- Acceptance of #877: `measureToolList` → `{ toolListVersion, toolCount }` in the `<release>-tools-<12 hex>` shape,
  hashed from the list as the client reads it on a recording server shaped like the served one, per access level, used
  as `serverInfo.version` by the factory with a release option, plus a testing helper. All in phase 1.
- Determinism: canonical JSON with sorted keys removes property-order noise from schema converters; sorting tools by
  name is recorded under Decisions with its reason.
- Compatibility: new exports only; the catalog check keeps its behaviour after the lister is shared (its existing tests
  cover it).
- Risk: a factory whose tools depend on the account would serve a stale version from the per-level cache. Documented,
  and `measureToolList` stays available for that case.
- Concurrency: caching the promise (not the value) avoids measuring twice under parallel first requests; a rejected
  measurement is dropped from the cache so the next request retries.

Verdict: approved, with the last point added to phase 1.

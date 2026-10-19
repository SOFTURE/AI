---
change_id: observability-endpoint-scheme-608
reviewed: 2026-10-19
verdict: approved
---

# Plan review: observability-endpoint-scheme-608

Checked plan.md against change.md, research.md, issue #608, `config.ts`, `start.ts` and `probe.ts`.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | Every ask of the issue maps to a step: no throw on a valid URL with another scheme, `disabled` with a reason, one warning naming the variable and the scheme, a malformed value still an error. | No change. |
| 2 | Major | The warning must not print the endpoint: a URL can carry credentials or a tenant in the query. Only the source name and `url.protocol` go into it. | Added to the tests in Phase 1. |
| 3 | Minor | `warnings` on the exported type changes a whole-object `toEqual` in an app's tests. | Accepted; recorded in change.md and the CHANGELOG. Readers of `kind`, `traces`, `logs` are unaffected. |
| 4 | Check | `probeObservability` returns `disabled` with the reason, so `softure-observability ping` under BuildKit prints why instead of crashing; no change needed there. | No change. |
| 5 | Check | The next adapter goes through `startObservability`, so it gets the same behaviour. | No change. |

No Critical findings.

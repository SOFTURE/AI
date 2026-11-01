---
change_id: pwa-manifest-icon-origin-920
reviewed: 2026-11-01
verdict: approved
---

# Plan review: pwa-manifest-icon-origin-920

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| F1 | WARNING | A per-request `RegExp` built from config text must not throw in the worker. | Planned: compiled once per entry when the worker starts, checked at build time. |
| F2 | WARNING | Network first must not hang on a silent network when nothing is kept. | Planned: bounded by `assetTimeoutMs` in total. |
| F3 | SUGGESTION | The page and the worker must agree on keys. | Planned: one exported helper, tested against the worker. |
| F4 | SUGGESTION | The config shape changes; the built-worker test must cover the new fields from the text alone. | Planned. |

No open CRITICAL findings.

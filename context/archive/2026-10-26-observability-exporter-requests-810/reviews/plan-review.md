---
change_id: observability-exporter-requests-810
verdict: approved
---

# Plan review

Reviewed against change.md, research.md, `src/node/start.ts`, `src/node/config.ts`, `instrumentation-http`
0.223.0 (`getRequestInfo`, `_outgoingRequestFunction`) and `otlp-exporter-base` `sendWithHttp`.

- Scope: matches the issue's ask; only the observability package, no API change.
- Correctness: the exporter always passes a `URL`, so the hook sees `protocol`, `hostname` and `path` in the shape
  `getRequestInfo` builds; filling the default port covers URLs without one. The restart path
  (`httpInstrumentation` reused across starts) re-runs `setConfig`, so a second start gets its own URLs.
- Regressions: a program call to another path or port keeps its metric and span; the positive control in the test
  pins that.
- Tests: the start test fails on master; the matcher's unit tests cover the boundary cases.

Verdict: approved, no changes.

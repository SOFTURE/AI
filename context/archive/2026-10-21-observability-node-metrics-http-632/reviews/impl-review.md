---
change_id: observability-node-metrics-http-632
reviewed: 2026-10-21
verdict: approved
---

# Implementation review: observability-node-metrics-http-632

Checked the diff of `config.ts`, `start.ts`, `ignore-paths-sampler.ts`, `next/index.ts`, the tests, README and
CHANGELOG against change.md and plan.md.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | Acceptance met: metrics reach `/v1/metrics` with `http.server.request.duration` and runtime metrics, with the auth header; `metrics.enabled: false` / `OTEL_METRICS_EXPORTER=none` stop them; server spans for a server created from a `node:http` import made before start; `ignorePaths` drops span and metric; both environment keys. | No change. |
| 2 | Major | `shutdown()` disabled the instrumentations before the meter provider's last collection, so the runtime gauges observed nothing on a shutdown without a flush (found by running a plain ESM app against a separate receiver process). | Providers shut down first, instrumentations after; test added (fails without the fix). |
| 3 | Major | require-in-the-middle hands `node:http` to the first hook only, so a second `HttpInstrumentation` after a restart never patched it. | One process-wide instance, re-configured and re-enabled per start; the meter provider falls back to the global no-op when metrics are off. |
| 4 | Check | The query string of an incoming request is recorded as `REDACTED`; the test asserts the token never reaches the export. | No change. |
| 5 | Minor | Outgoing `http.request` and `fetch` client spans keep `url.full` with the query, redacting only the instrumentation's default names; unchanged behaviour for `fetch`, new for `http.request`. | Accepted, outside the issue; the README names the outgoing spans. |
| 6 | Minor | New default series for upgrading apps. | README "Metrics" counts them; CHANGELOG names the off switches. |

Manual check: a plain ESM script (`import { createServer } from "node:http"` before `startObservability`) against a
receiver in another process: server span with `url.query=REDACTED`, `http.server.request.duration`, 11 runtime
metrics and both environment keys arrived.

Gates: typecheck, ESLint and the language gate clean; 107 observability tests pass.

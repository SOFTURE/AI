---
change_id: observability-short-lived-814
---

# Research

Read on master (4b2821f): `foundation/observability/src/node/start.ts`, `src/node/config.ts`, the tests
(`tests/start.test.ts`, `tests/signals.test.ts`, `tests/fixtures/signal-child.ts`) and the README's "Node.js" and
"Metrics" sections.

- Metric export is decided in `resolveObservabilityConfig` (`isMetricExportOff`: `metrics.enabled: false` or
  `OTEL_METRICS_EXPORTER=none`). With `metrics: null` no `MeterProvider` is built, the runtime instrumentation is not
  registered (it requires a meter provider) and the HTTP instrumentation gets the no-op meter provider. So turning
  metrics off in the resolver is the one switch the short mode needs; traces and logs are untouched.
- Flushing today: `shutdown()` is the app's job; `handleSignals` covers SIGTERM/SIGINT. A script that forgets
  `await observability.shutdown()` loses the last batch (the batch processors export every 5 s / 1 s and their timers
  are unref'd, so the process ends without them).
- Node's `beforeExit` fires when the event loop empties on a natural end (not on `process.exit()` and not on an
  uncaught exception). Async work scheduled in it keeps the process alive until it settles, after which `beforeExit`
  fires again; `shutdown()` is memoized and a `once` listener does not re-run. The exit code set via
  `process.exitCode` is kept.
- `process.exit()` cannot wait for an async flush: a script that calls it must `await shutdown()` first. Documented,
  not worked around.
- The adopting app worked around it with `metrics: { enabled: false }` in its own script wrapper; the package option
  replaces that.

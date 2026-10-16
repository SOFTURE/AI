---
change_id: observability-stable-http-545
---

# Research: observability-stable-http-545

Sources: `foundation/observability/src/node/start.ts`, `src/next/index.ts`,
`node_modules/@opentelemetry/sdk-trace/build/esm/Span.js` and `SpanProcessor.d.ts` (2.12.0).

- `Span.end()` calls `spanProcessor.onEnding(span)` before it sets `_ended`, so `setAttribute` still works there;
  `onEnd` gets a read-only span. `onEnding` is marked experimental, but the dependency range is `^2.12.0`; a test pins
  the behaviour, so a break in a minor version shows up as a red test on a lockfile update.
- `NodeTracerProvider` takes `spanProcessors` in order; `MultiSpanProcessor.onEnding` calls every processor's
  `onEnding` before any `onEnd`, so the position next to the `BatchSpanProcessor` does not matter.
- Next.js starts `BaseServer.handleRequest` with `http.method` and `http.target` (path plus query) and sets
  `http.status_code` before ending it. The package adds no HTTP server instrumentation of its own.
- The existing tests use a local OTLP receiver and look for strings in the protobuf body; an in-memory exporter
  (`InMemorySpanExporter`, exported by sdk-trace-node) gives exact attribute assertions instead.

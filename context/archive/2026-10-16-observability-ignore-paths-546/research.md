---
change_id: observability-ignore-paths-546
---

# Research: observability-ignore-paths-546

Sources: `foundation/observability/src/node/start.ts`, `@opentelemetry/sdk-trace` 2.12.0 (`Sampler.d.ts`,
`ParentBasedSampler`, `AlwaysOnSampler`, exported by sdk-trace-node).

- `NodeTracerProvider` takes `sampler`; without one the SDK uses `ParentBased(AlwaysOn)`, so delegating to that keeps
  the default for every other span.
- `shouldSample` gets the start attributes. Next.js passes `http.method` and `http.target` (path plus query) when it
  starts `BaseServer.handleRequest`; stable instrumentations pass `url.path`. The span name (`GET /api/health`) is not
  needed.
- A span started under a non-recording parent goes through `ParentBased`, which returns `NOT_RECORD` for an unsampled
  local parent, so the children of a dropped request are dropped too.

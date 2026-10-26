---
change_id: observability-exporter-requests-810
status: planned
---

# Plan: the OTLP exporter's own requests are not measured (issue #810)

Input: change.md, research.md. Complexity: small (one hook, a test, docs).

## Phase 1: skip export requests in the http instrumentation

Files: `foundation/observability/src/node/export-request-matcher.ts` (new), `foundation/observability/src/node/start.ts`,
`foundation/observability/tests/export-request-matcher.test.ts` (new), `foundation/observability/tests/start.test.ts`.

1. Test first (start.test.ts): with an endpoint and metrics on, a program `http.get` to the app server and two
   flushes; the metrics body has `http.client.request.duration` for the app server's address but not for the
   receiver's. Fails on master.
2. `createExportRequestMatcher(urls)`: returns `(options) => boolean`, true when protocol, hostname, port (default
   filled in) and path equal one of the export URLs. Unit tests: exact match, default port, IPv6, another path on
   the same host, another port, empty list.
3. `startHttpInstrumentation` passes `ignoreOutgoingRequestHook` built from the traces, logs and metrics URLs.

## Phase 2: docs

Files: `foundation/observability/README.md`, `foundation/observability/CHANGELOG.md`.

1. README Metrics: `http.client.request.duration` leaves out the exporter's own requests.
2. CHANGELOG `## Unreleased`: the fix; an app that turned `instrumentations.http` off only for this can turn it back on.

## Decisions (auto)

- Exact URL match (origin and path) over a host-only match: a program may call other paths on the collector's host.
- The hook skips spans too (the instrumentation has no metric-only switch); the exporter suppresses those spans
  already, so nothing visible changes for traces.
- No version bump (brief); patch-level fix.

## Progress

- [x] Phase 1: skip export requests in the http instrumentation (f1753b1)
- [ ] Phase 2: README and CHANGELOG

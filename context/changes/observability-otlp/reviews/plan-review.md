# Plan review: observability-otlp

Reviewed: plan.md @ 2026-10-10. Mode: deep. Verdict: ready after fixes.
Findings: 1 critical, 3 warning, 1 suggestion.
Grounding: 9/9 paths (template, packages.test.ts, release-rules.mjs, safe-error.ts, example app files), 4/4 symbols
(`errorLogLabel`, `findWorkspaces`, `checkManifest`, example `register`), 4/4 commands (workflow.json gates, `npm run e2e`, `npm run build`).
Deep verification: experiments with next 16.4.0 and the pinned OpenTelemetry versions in the session scratchpad
(not in the repo).

## Lenses
| Lens | Result |
| --- | --- |
| Coverage and end state | FAIL (C1) |
| Slicing | PASS |
| Verifiability | WARN (W3, S1) |
| Data and migrations | PASS (no data) |
| Tests | WARN (W2) |
| Security | PASS (header never printed, tested) |
| Lean | PASS |
| Fit | PASS |
| Cost and defaults | PASS |
| Scope | PASS |
| Reuse | PASS (`errorLogLabel` reused) |
| Lessons | PASS (L-001 tsc build, L-002 avoided: the Next adapter imports nothing from `next`) |
| Progress format | PASS |

## Findings

### C1 [CRITICAL] `node:http` instrumentation records nothing in an ESM process, and in Next it would re-parent Next's spans
**Effort:** low. **Lens:** Coverage and end state. **Where:** Goal ("incoming and outgoing HTTP"), Phase 2 step 2.
**Problem:** experiment: an ESM script that imports `node:http` before `registerInstrumentations` gets no spans from
`HttpInstrumentation` (`http.get.__wrapped` stays false until a later `require('http')`). In Next, Next's own request
span (`BaseServer.handleRequest`) skips header extraction when a span is already active
(`next/dist/server/lib/trace/tracer.js:167-169`), so an http server span would become its parent. Undici
instrumentation works through diagnostics_channel regardless of load order, but Next already creates a `fetch` span
(`patch-fetch.js:281-283`), so enabling it in Next duplicates client spans unless `NEXT_OTEL_FETCH_DISABLED=1`.
**Fix:** drop `instrumentation-http`; keep undici on by default for plain Node and off by default in the Next adapter;
state it in Goal, Out of scope, Key decisions and README.
**Decision:** Fix now (applied) - Goal, Out of scope, Approach, Key decisions, Phase 2 step 2 and tests, Phase 3 step 1 and README step updated.

### W1 [WARNING] Phase 1 uses `errorLogLabel` without depending on `@softure-ai/core`
**Effort:** low. **Lens:** Fit. **Where:** Phase 1 steps 1 and 3.
**Problem:** step 3 calls `errorLogLabel` from `@softure-ai/core`, step 1 lists only OTel dependencies; the build would fail.
`@softure-ai/core` 0.1.9 depends only on zod, so it adds no weight.
**Fix:** add `@softure-ai/core` to dependencies; add `@opentelemetry/sdk-trace-node` to dev dependencies for the trace-id test.
**Decision:** Fix now (applied).

### W2 [WARNING] Global OTel state leaks between tests
**Effort:** low. **Lens:** Tests. **Where:** Phase 2 tests.
**Problem:** providers registered through the global API stay registered in the worker; a second
`logs.setGlobalLoggerProvider` is ignored silently (`api-logs/build/src/api/logs.js:21-24`), so later tests would
assert against a stale provider.
**Fix:** an internal `resetObservabilityForTests()` (not in `package.json` exports) that shuts down, clears the
`globalThis` handle and disables the trace, logs, context and propagation APIs; called in `afterEach`.
**Decision:** Fix now (applied).

### W3 [WARNING] The "nothing goes to localhost:4318" test needs a fixed port
**Effort:** low. **Lens:** Verifiability. **Where:** Phase 2 tests.
**Problem:** binding port 4318 in a test is flaky on shared machines and proves less than checking that no provider
exists.
**Fix:** assert `isExporting === false` and that the global tracer and logger providers are still the no-op ones.
**Decision:** Fix now (applied).

### S1 [SUGGESTION] Manual item 3.4 belongs to the adopting app's change
**Effort:** low. **Lens:** Verifiability. **Where:** Phase 3 Done when, Progress 3.4.
**Problem:** it cannot be checked inside this change and would linger as an open owner check.
**Fix:** remove it; the adoption change in the app carries it.
**Decision:** Fix now (applied).

## Triage summary
Fixed: C1, W1, W2, W3, S1. Accepted: -. Deferred: -. Dismissed: -. Verdict after triage: ready after fixes.

## Decisions (auto)
- C1 http instrumentation → Fix now (measured; dropping it keeps the package smaller and correct).
- W1 core dependency → Fix now (contract break).
- W2 global state → Fix now (test isolation).
- W3 localhost port → Fix now (cheaper and stronger assertion).
- S1 manual item → Fix now (cheap).
- Also recorded from the verification: Next reads the npm `@opentelemetry/api` first, so a provider registered by the
  package reaches Next's spans (added to Critical details with the single-api README check).

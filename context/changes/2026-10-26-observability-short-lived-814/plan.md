---
change_id: observability-short-lived-814
status: in_progress
---

# Plan: a short-lived mode for one-shot processes (issue #814)

Input: change.md, research.md. Complexity: small (one option in one package, tests, docs).

## Phase 1: `lifetime: "short"` (TDD)

Files: `foundation/observability/src/node/config.ts`, `src/node/start.ts`, `tests/config.test.ts`,
`tests/lifetime.test.ts`, `tests/fixtures/short-lived-child.ts`.

1. Tests first: `resolveObservabilityConfig` with `lifetime: "short"` resolves `metrics: null` and keeps traces and
   logs, also with `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT` set; `lifetime: "long"` (and omitted) exports metrics as
   before. A child process started with `lifetime: "short"` that logs and ends on its own without calling
   `shutdown()` delivers its logs to the receiver, sends nothing to `/v1/metrics`, and exits with the exit code it
   set itself.
2. `ObservabilityOptions.lifetime?: "long" | "short"` (default `"long"`); `isMetricExportOff` also returns true for
   `"short"`. With `"short"`, `startObservability` adds a `process.once("beforeExit")` listener that calls
   `shutdown()`; `dispose` (tests) removes it.

## Phase 2: docs

`foundation/observability/README.md` (a "Scripts and one-shot processes" subsection under "Node.js", the "Series"
paragraph names the cost per run), `CHANGELOG.md` `## Unreleased`.

## Decisions (auto)

- An option `lifetime: "short"` rather than a `runObservedScript` helper: it composes with any script layout (top-level
  await, a CLI framework) and keeps one entry point. A helper can come later on request.
- `"short"` wins over `metrics.enabled`: a script that wants metrics leaves `lifetime` at its default.
- The flush runs on `beforeExit` only; `process.exit()` and uncaught exceptions are documented as needing an explicit
  `await shutdown()`.
- Histogram views / bucket boundaries (the issue's "Related") are out of scope.

## Progress

- [ ] Phase 1: `lifetime: "short"`
- [ ] Phase 2: docs

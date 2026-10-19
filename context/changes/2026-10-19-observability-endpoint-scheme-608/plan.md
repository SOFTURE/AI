---
change_id: observability-endpoint-scheme-608
status: in_progress
---

# Plan: an unsupported OTLP endpoint scheme disables the signal (issue #608)

Input: change.md, research.md. Complexity: small (one resolver, one caller's logging, tests, docs).

## Phase 1: resolver and start (TDD)

Files: `foundation/observability/src/node/config.ts`, `src/node/start.ts`, `tests/config.test.ts`,
`tests/start.test.ts`.

1. Tests first:
   - `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=unix:///dev/otel-grpc.sock` alone → `disabled`, reason and the one warning
     name the variable and `unix:`, not the path;
   - unsupported traces variable plus an https base endpoint → `export` with `traces: null`, logs to the base, one
     warning;
   - `options.endpoint: "grpc://collector:4317"` → `disabled`, warning names `options.endpoint` and `grpc:`;
   - `"not a url"` still throws naming the source;
   - `startObservability` with the unix variable does not throw, warns once and reports `isExporting: false`.
2. Implement: `checkUrl` returns the URL or an unsupported-scheme warning; `resolveSignal` collects warnings;
   `warnings` on both config variants; the no-signal reason is the warnings when there are any; `start.ts` prints
   each warning with `console.warn` before the existing lines.

## Phase 2: docs

`foundation/observability/README.md` (the malformed-values paragraph), `CHANGELOG.md` `## Unreleased` with what the
adopting app can drop (`OTEL_SDK_DISABLED=true` on the build step) once released.

## Progress

- [ ] Phase 1: resolver and start (TDD)
- [ ] Phase 2: docs

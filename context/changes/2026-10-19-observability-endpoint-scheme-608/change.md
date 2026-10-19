---
change_id: observability-endpoint-scheme-608
title: "observability: an OTLP endpoint with an unsupported scheme disables that signal instead of throwing (issue #608)"
status: in_progress
roadmap_item: null
issue: 608
branch: claude/project-thread-oeszy5
created: 2026-10-19
updated: 2026-10-19
---

## Intent

Close [issue #608](https://github.com/SOFTURE/AI/issues/608). `startObservability` (observability 0.2.0) throws when
an OTLP endpoint has a scheme other than `http:`/`https:`. Docker BuildKit sets
`OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=unix:///dev/otel-grpc.sock` in every `RUN` step, so any script that starts
observability during `docker build` dies. Telemetry must never take down the program it observes.

## Context

Labels: `bug`. observability 0.2.0 is the latest on npm and on master. The check lives in `checkUrl` in
`foundation/observability/src/node/config.ts`; `startObservability` and `probeObservability` both call
`resolveObservabilityConfig`. Releases are batched by the coordinator: no version bump, the CHANGELOG gets
`## Unreleased`.

## Acceptance

- An endpoint that parses as a URL but has a scheme other than `http:`/`https:` (`unix:`, `grpc:`) no longer throws:
  that signal is not exported, and the resolved config carries a warning naming the source and the scheme, never the
  value.
- When no signal is left, the config is `disabled` with that warning as its reason; when the other signal still has
  an http(s) endpoint, that signal keeps exporting.
- `startObservability` prints each warning once with `console.warn`; it does not throw.
- A value that is not a URL at all still throws, naming the source.
- The repro from the issue (`OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=unix:///dev/otel-grpc.sock`) starts with export
  disabled.

## Notes

- Framing: skipped. The issue states the problem, the expected behaviour and a repro.

## Decisions (auto)

- The resolved config gets `warnings: string[]` on both variants (a pure function cannot log; the callers decide). It
  is additive for readers; a test or caller that compares the whole object with `toEqual` sees the new key.
- The rule applies to every source, `options.endpoint` included: the outcome the issue asks for (never crash on an
  endpoint the package cannot export to) does not depend on who set it.
- A per-signal variable with an unsupported scheme does not fall back to the base endpoint: the per-signal variable
  wins by the OTel spec, and BuildKit meant that signal to go to its socket, not elsewhere.

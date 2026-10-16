---
change_id: observability-probe-547
status: archived
---

# Plan: export probe (issue #547)

Input: change.md, research.md. Complexity: medium (a probe, a command, a bin, tests, docs).

## Phase 1: probe (TDD)

Files: `foundation/observability/src/node/probe.ts`, `tests/probe.test.ts`, `tests/otlp-receiver.ts` (a status
option).

1. Tests first: against a receiver answering 200 both signals are accepted and the bodies carry `softure.probe`;
   401 and 404 come back refused with the status; no endpoint gives `disabled`; a signal without an endpoint is
   `not configured`.
2. `probeObservability(options, env)`.

## Phase 2: command

Files: `src/cli/ping.ts` (`runObservabilityCli`), `src/cli/bin.ts`, `package.json` (`bin`), `tests/ping.test.ts`.

1. Tests first: exit 0 on 200, exit 1 with `HTTP 401` / `HTTP 404` in the output, exit 1 without an endpoint, exit 2
   on an unknown command; the auth header never appears in the output.
2. The command and the bin.

## Phase 3: docs

`README.md` (the probe, the command, deploy verification), `CHANGELOG.md` `## Unreleased`.

## Progress

- [x] Phase 1: probe
- [x] Phase 2: command
- [x] Phase 3: docs

`@opentelemetry/core` (already installed through the SDK) became a direct dependency for `ExportResultCode`; the
typed lint rule refuses comparing the enum with a number. Gates on the branch: typecheck, lint, build and `npm test`;
the built bin prints the disabled message and exits 1 without an endpoint.

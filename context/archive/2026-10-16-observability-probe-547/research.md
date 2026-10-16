---
change_id: observability-probe-547
---

# Research: observability-probe-547

Sources: `foundation/observability/src/node/start.ts`, `config.ts`, `@opentelemetry/otlp-exporter-base`
(`http-transport-utils.js`, `otlp-export-delegate.js`), `@opentelemetry/sdk-logs` `SimpleLogRecordProcessor`,
`modules/mailing/src/cli/bin.ts` (bin layout), `tests/repo/packages.test.ts`.

- A refused export reaches the exporter's `export` callback as `{ code: FAILED, error }`; for a non-retryable status
  (401, 403, 404) the error is an `OTLPExporterError` with `code` = the HTTP status. Retryable statuses (429, 502-504)
  are retried until `timeoutMillis` and end in an error without a code.
- Wrapping each OTLP exporter in a small exporter that forwards `export` and keeps the result gives the outcome
  without reading `diag`; `SimpleSpanProcessor` and `SimpleLogRecordProcessor` export on end and emit.
- Private `BasicTracerProvider` and `LoggerProvider` instances, never registered, leave the app's globals alone.
- Bins in this repository live at `src/cli/bin.ts` (built to `dist/cli/bin.js`) with the logic in a testable module.

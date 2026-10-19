---
change_id: observability-endpoint-scheme-608
---

# Research: observability-endpoint-scheme-608

Sources: `foundation/observability/src/node/config.ts`, `src/node/start.ts`, `src/node/probe.ts`, `src/cli/`,
`tests/config.test.ts`, `tests/start.test.ts`, `README.md` (configuration table and the malformed-values paragraph),
`CHANGELOG.md`.

- `resolveSignalUrl` picks `options.endpoint`, else `OTEL_EXPORTER_OTLP_<SIGNAL>_ENDPOINT`, else
  `OTEL_EXPORTER_OTLP_ENDPOINT`, and passes the value to `checkUrl`, which throws `"<source> is not a URL"` or
  `"<source> must be an http(s) URL"`. Nothing catches it; `startObservability` throws to the app.
- `ResolvedObservabilityConfig` is `{ kind: "disabled"; reason }` or `{ kind: "export"; traces; logs;
  resourceAttributes }`, exported from `/node`. `start.ts` logs `export disabled (<reason>)` with `console.log`;
  `probe.ts` returns `{ kind: "disabled", reason }`, which the `ping` command prints.
- BuildKit's variable is only the traces one; logs then have no endpoint, so the docker case resolves to no signal at
  all.
- `new URL("unix:///dev/otel-grpc.sock").protocol` is `"unix:"`; `new URL("grpc://h:4317").protocol` is `"grpc:"`.
- `tests/config.test.ts` has one test asserting that `ftp://` throws; it becomes the degrade test. Disabled-config
  tests compare with `toEqual` and need the new `warnings` key.
- The README says a non-http(s) endpoint throws at start; that sentence changes.

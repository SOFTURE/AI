# @softure-ai/observability

Logs and traces for Node.js processes and Next.js apps, shipped to any OpenTelemetry (OTLP/HTTP) backend:

- a structured logger: levels, attributes, child loggers, one line on the console, and an OpenTelemetry log record
  that carries the active trace and span ids ([Logger](#logger));
- one call that starts OpenTelemetry in a process: a tracer provider and a logger provider exporting over
  OTLP/HTTP protobuf, the resource attributes the app chooses, and spans for outgoing `fetch`
  ([Node.js](#nodejs), [Next.js](#nextjs));
- an `onRequestError` for Next.js that logs every failed request with its route ([Next.js](#nextjs)).

The package carries no project, service or vendor names: the app passes them. With no endpoint configured nothing is
exported and the loggers write to the console only.

## Installation

```bash
npm install @softure-ai/observability
```

Inside this repository it is a workspace package.

## Configuration

`startObservability(options)` (and `registerObservability(options)` for Next.js) takes:

| Option | Environment fallback | Meaning |
| --- | --- | --- |
| `serviceName` | `OTEL_SERVICE_NAME`, then `service.name` in `OTEL_RESOURCE_ATTRIBUTES` | `service.name`: the process, e.g. `api` |
| `serviceNamespace` | `service.namespace` in `OTEL_RESOURCE_ATTRIBUTES` | `service.namespace`: the project |
| `serviceVersion` | `service.version` in `OTEL_RESOURCE_ATTRIBUTES` | `service.version` |
| `environment` | `deployment.environment.name` in `OTEL_RESOURCE_ATTRIBUTES` | `deployment.environment.name`, e.g. `production` |
| `endpoint` | `OTEL_EXPORTER_OTLP_ENDPOINT` | base URL; `/v1/traces` and `/v1/logs` are appended |
| — | `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`, `OTEL_EXPORTER_OTLP_LOGS_ENDPOINT` | per-signal URL, used as given |
| `headers` | `OTEL_EXPORTER_OTLP_HEADERS` (`key=value,key2=value2`, URL-encoded values) | headers of every export, e.g. `Authorization` |
| — | `OTEL_EXPORTER_OTLP_TRACES_HEADERS`, `OTEL_EXPORTER_OTLP_LOGS_HEADERS` | added to the headers of one signal |
| `enabled` | `OTEL_SDK_DISABLED=true` turns export off | `false` turns export off |
| `instrumentations.fetch` | — | spans for outgoing `fetch` (undici); default `true`, `false` in the Next.js adapter |
| `logLevel` | `SOFTURE_LOG_LEVEL` | minimum level: `debug`, `info` (default), `warn`, `error` |
| `errorDetails` | — | `full` (default) or `label`, see [Errors and personal data](#errors-and-personal-data) |
| `handleSignals` | — | flush on SIGTERM and SIGINT (at most 5 s), then end the process; default `false` |

Options win over the environment. Headers merge per key: per-signal variables over `OTEL_EXPORTER_OTLP_HEADERS`,
`headers` over both. A signal without an endpoint is not exported; with neither, nothing is.

A malformed value (an endpoint that is not an http(s) URL, a header entry without a key) throws at start with the name
of the option or variable, never its value; in Next.js that stops the server from starting, which is deliberate. A
failed export (a wrong token, an unreachable endpoint) is printed as an OpenTelemetry error on the console.

**Secrets.** The `Authorization` header is a credential: pass it from the environment (`OTEL_EXPORTER_OTLP_HEADERS`
or your own variable read into `headers`), never from code or a committed file. The package never prints headers;
its one start-up line names only the endpoint origin and `service.name`.

Example environment for a hosted OTLP gateway:

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp.example.com/otlp
OTEL_EXPORTER_OTLP_HEADERS=Authorization=Basic%20<base64 of instance-id:token>
```

## Node.js

Start it once, before the work begins:

```ts
import { createLogger } from "@softure-ai/observability";
import { startObservability } from "@softure-ai/observability/node";

const observability = startObservability({
  serviceName: "worker",
  serviceNamespace: "my-project",
  environment: process.env.APP_ENVIRONMENT,
  handleSignals: true,
});

const logger = createLogger("worker");
logger.info("started");

// A script that ends on its own: flush before it exits.
await observability.shutdown();
```

A second `startObservability` in the same process returns the first handle (and warns once).

`handleSignals: true` flushes on SIGTERM and SIGINT for at most 5 seconds. When the app has no listener of its own for
that signal, the package then re-raises it and the process ends as it would have; when the app listens to it itself,
ending the process stays the app's job (call `shutdown()` in that listener to wait for the flush).

## Next.js

`instrumentation.ts`:

```ts
import { createLogger } from "@softure-ai/observability";
import { createOnRequestError, registerObservability } from "@softure-ai/observability/next";

export async function register(): Promise<void> {
  await registerObservability({
    serviceName: "web",
    serviceNamespace: "my-project",
    environment: process.env.APP_ENVIRONMENT,
  });
}

export const onRequestError = createOnRequestError(createLogger("next"));
```

`next.config.ts`: keep the package and OpenTelemetry out of the server bundle:

```ts
const nextConfig = {
  serverExternalPackages: ["@softure-ai/observability"],
};
```

What you get:

- Next.js's own spans (the request, rendering, route handlers, `fetch`) go to the tracer provider the package
  registers. Next.js looks up the app's `@opentelemetry/api` first, so the app must resolve one copy of it:
  `npm ls @opentelemetry/api` should show a single version.
- `fetch` spans of the undici instrumentation are off in Next.js, because Next.js spans `fetch` itself. Turning
  them on (`instrumentations: { fetch: true }`) calls for `NEXT_OTEL_FETCH_DISABLED=1`, or every call is spanned twice.
- `registerObservability` does nothing in the edge runtime.
- `onRequestError` logs one error record per failed request with `http.request.method`, `url.path` (without the
  query string, which can carry tokens), `next.route`, `next.route_type` and the error. Request headers are never logged.

## Logger

```ts
import { configureLogging, createLogger } from "@softure-ai/observability";

const logger = createLogger("orders");
logger.info("order saved", { orderId: 42 });

const tenantLogger = logger.child({ tenant: "acme" });
tenantLogger.warn("slow query", { ms: 1200 });

try {
  await save();
} catch (error) {
  logger.error("order save failed", { error, orderId: 42 });
}
```

- Console: `info orders: order saved orderId=42`; `warn` and `error` go to `console.error`, the rest to `console.log`.
  Line breaks in the message are escaped, so one call is always one line.
- OpenTelemetry: one log record per call, with the logger name as the instrumentation scope, the severity, the
  message as the body and the fields as attributes; inside an active span it carries the trace and span ids.
- Field values: strings, numbers, booleans and arrays of one of them stay as they are; a `Date` becomes its ISO
  string, anything else its JSON; `undefined` and `null` are left out. `error` is the thrown value.
- Level: the logger's own `level` option, else `configureLogging({ level })`, else `SOFTURE_LOG_LEVEL`, else `info`.
- The logger works without `startObservability` (tests, scripts): it writes to the console only.

### Errors and personal data

By default an error is recorded as `exception.type`, `exception.message` and `exception.stacktrace`. Error messages
can carry personal data (a database error holds the failed query and its parameters). An app that cannot allow that
anywhere sets `errorDetails: "label"` (or `configureLogging({ errorDetails: "label" })`): the message becomes
`errorLogLabel(error)` of `@softure-ai/core` (the class name and SQLSTATE) and the stack is dropped.

## Limitations

- No metrics: only traces and logs are exported.
- No browser telemetry: an OTLP token must not reach a client bundle; use the frontend's own error reporting.
- No `node:http` instrumentation: it cannot patch an ES module process that imported `http` first, and in Next.js it
  would re-parent Next.js's spans. Incoming requests of a plain Node.js server are not spanned.
- OTLP/HTTP protobuf only (no gRPC, no JSON).
- Batches are sent every few seconds; a process killed without `shutdown()` (or `handleSignals`) can lose the last one.

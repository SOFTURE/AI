# @softure-ai/observability

Logs and traces for Node.js processes and Next.js apps, shipped to any OpenTelemetry (OTLP/HTTP) backend:

- a structured logger: levels, attributes, child loggers, one line on the console, and an OpenTelemetry log record
  that carries the active trace and span ids ([Logger](#logger));
- one call that starts OpenTelemetry in a process: a tracer provider and a logger provider exporting over
  OTLP/HTTP protobuf, the resource attributes the app chooses, and spans for outgoing `fetch`
  ([Node.js](#nodejs), [Next.js](#nextjs));
- an `onRequestError` for Next.js that logs every failed request with its route ([Next.js](#nextjs));
- a probe that proves the backend accepts a span and a log record, as a function and as the
  `softure-observability ping` command ([Verifying the export](#verifying-the-export)).

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
| `traces.ignorePaths` | — | paths whose incoming requests get no trace, e.g. `["/api/health"]`, see [Health checks](#health-checks) |
| `traces.stableHttpAttributes` | — | copies legacy HTTP server attributes onto their stable names; default `false`, `true` in the Next.js adapter, see [Next.js](#nextjs) |
| `logLevel` | `SOFTURE_LOG_LEVEL` | minimum level: `debug`, `info` (default), `warn`, `error` |
| `errorDetails` | — | `full` (default) or `label`, see [Errors and personal data](#errors-and-personal-data) |
| `handleSignals` | — | flush on SIGTERM and SIGINT (at most 5 s), then end the process; default `false` |

Options win over the environment. Headers merge per key: per-signal variables over `OTEL_EXPORTER_OTLP_HEADERS`,
`headers` over both. A signal without an endpoint is not exported; with neither, nothing is.

A malformed value (an endpoint that is not a URL, such as `localhost:4318` without `http://`, a header entry without a
key) throws at start with the name of the option or variable, never its value; in Next.js that stops the server from
starting, which is deliberate. An endpoint with a scheme other than `http:` or `https:` (Docker BuildKit sets
`OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=unix:///dev/otel-grpc.sock` in every `RUN` step; `grpc://`) does not throw: that
signal is not exported, the start-up prints one warning naming the variable and the scheme, and the other signal keeps
its own endpoint. A per-signal variable is not replaced by `OTEL_EXPORTER_OTLP_ENDPOINT` then. A failed export (a wrong
token, an unreachable endpoint) is printed as an OpenTelemetry error on the console.

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

### Health checks

A container health check every 15 s is about 5,760 traces a day per container, most of what a quiet app sends.
`traces: { ignorePaths: ["/api/health"] }` drops the server span of such a request and every span under it:

- an entry matches its own path and everything below it as whole segments: `/api/health` also drops
  `/api/health/live`, but not `/api/healthz`; the query string is ignored;
- only incoming requests (server spans) are matched, read from `url.path` or `http.target`; an outgoing call to that
  path is still traced;
- every other span is sampled as without the option (`ParentBased(AlwaysOn)`);
- an entry that does not start with `/` throws at start, with or without an endpoint.

The health check's own failures still reach the logs: only its traces are dropped.

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
- `registerObservability` does nothing in the edge runtime, and starts in every Node.js server: `next start` and the
  standalone `server.js` (`output: "standalone"`, where `NEXT_RUNTIME` is unset at runtime) alike.
- Next.js's server spans (`BaseServer.handleRequest`) carry only the legacy HTTP attributes. The adapter copies them
  onto their stable names when the span ends (`traces.stableHttpAttributes`, on by default here), so queries written
  against the current conventions match:

  | Legacy (kept) | Stable (added) |
  | --- | --- |
  | `http.status_code` | `http.response.status_code` |
  | `http.method` | `http.request.method` |
  | `http.target` | `url.path` (without the query string) |

  A stable key the span already has is kept. Before an app runs a version with this, query `http.status_code`
  (e.g. `span.http.status_code >= 500` in Tempo). `traces: { stableHttpAttributes: false }` turns it off.
- `onRequestError` logs one error record per failed request with `http.request.method`, `url.path` (without the
  query string, which can carry tokens), `next.route`, `next.route_type` and the error. Request headers are never logged.

## Verifying the export

An app that logs only `warn` and `error` sends no log record until something fails, so a wrong `/v1/logs` endpoint
or a token without log-write scope would stay hidden until the logs are needed. The start-up line
`observability: exporting …` only says export is configured. The probe says whether the backend accepts it:

```bash
# Same OTEL_* variables as the app; once per release, e.g. as a deploy verification step.
npx softure-observability ping --service-name web
```

```text
traces: accepted by https://otlp.example.com/otlp/v1/traces
logs: refused by https://otlp.example.com/otlp/v1/logs (HTTP 401: Unauthorized)
```

- It sends one span and one log record, both named `softure.probe` with the attribute `softure.probe=true`, so a query
  can leave them out (`softure.probe != true`).
- Exit code `0` when every configured signal is accepted; `1` when one is refused (with the HTTP status, or
  `no response` for an unreachable endpoint or a timeout of 10 s), when no endpoint is set, or when a variable is
  malformed; `2` on a usage error. A signal without an endpoint prints `not configured` and does not fail the check.
- Headers are never printed, and the endpoint shows as origin and path only.

From code, `probeObservability(options)` of `/node` takes the options of `startObservability` (plus `timeoutMs`) and
returns the outcome per signal. It uses providers of its own, so calling it in a running app leaves the app's export
alone.

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

// Observability for an app on Cloudflare Workers, where the OpenTelemetry Node SDK does not run: `withObservability`
// wraps the Worker's fetch handler, records one server span per request, collects the records of every
// `createLogger` logger written during it (with the span's trace and span ids), and sends both over OTLP/HTTP JSON
// with `fetch` under `ctx.waitUntil`, so the response does not wait for the export. Settings are the Node entry's
// (`OTEL_EXPORTER_OTLP_*`, `OTEL_SERVICE_NAME`, the options), read from the Worker's bindings; nothing leaves
// without an endpoint. No metrics: an isolate has no process to measure. `withScheduledObservability` does the same
// for the Worker's `scheduled` handler (a Cron Trigger), so the logs of background work leave the isolate too.
import { AsyncLocalStorage } from "node:async_hooks";

import { logs, type LogRecord, type Logger as OtelLogger, type LoggerProvider } from "@opentelemetry/api";

import { createIgnoredPathMatcher } from "../ignored-paths.js";
import { configureLogging, createLogger } from "../logger.js";
import { resolveObservabilityConfig, type Environment, type ObservabilityOptions, type ResolvedObservabilityConfig, type SignalExport } from "../node/config.js";
import { encodeLogs, encodeSpans, SPAN_KIND_INTERNAL, SPAN_KIND_SERVER, STATUS_ERROR, STATUS_UNSET, toUnixNano, type OtlpAttributeValue, type OtlpLogRecord, type OtlpSpan } from "./otlp-json.js";

export type WorkersObservabilityOptions = Pick<
  ObservabilityOptions,
  "serviceName" | "serviceNamespace" | "serviceVersion" | "environment" | "endpoint" | "headers" | "enabled" | "logLevel" | "errorDetails"
> & {
  /** Paths whose requests get no span (their log records are still sent), as `traces.ignorePaths` on Node. */
  readonly ignorePaths?: readonly string[];
  /** The `fetch` that sends the export; tests pass a fake. Default the global `fetch`. */
  readonly fetch?: typeof fetch;
};

/** The part of a Worker's `ExecutionContext` this entry uses. */
export interface WorkersExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

export type WorkersFetchHandler<Env> = (request: Request, env: Env, ctx: WorkersExecutionContext) => Promise<Response> | Response;

/** The part of a Cron Trigger's `ScheduledController` this entry uses. */
export interface WorkersScheduledController {
  readonly scheduledTime: number;
  readonly cron: string;
}

export type WorkersScheduledHandler<Env, Result = unknown> = (
  controller: WorkersScheduledController,
  env: Env,
  ctx: WorkersExecutionContext,
) => Promise<Result> | Result;

export type WorkersScheduledObservabilityOptions = Omit<WorkersObservabilityOptions, "ignorePaths">;

const SCOPE = "@softure-ai/observability/workers";
/** Records written outside a request (at module load) wait for the next request's export, at most this many. */
const MAX_PENDING_RECORDS = 100;
const TRACEPARENT = /^00-([0-9a-f]{32})-([0-9a-f]{16})-[0-9a-f]{2}$/;

type RequestTelemetry = {
  readonly traceId: string;
  readonly spanId: string;
  readonly records: OtlpLogRecord[];
};

const requestStorage = new AsyncLocalStorage<RequestTelemetry>();
const pendingRecords: OtlpLogRecord[] = [];
const requestLogger = createLogger(SCOPE);

/**
 * The Worker's fetch handler with a server span and log export per request. Use it as the default export's `fetch`:
 * `export default { fetch: withObservability(handler, { serviceNamespace: "shop", serviceName: "shop" }) }`.
 */
export function withObservability<Env>(handler: WorkersFetchHandler<Env>, options: WorkersObservabilityOptions = {}): WorkersFetchHandler<Env> {
  configureWorkersLogging(options);

  const isIgnoredPath = createIgnoredPathMatcher(options.ignorePaths ?? []);
  // Per handler, since the options differ between handlers; per bindings object, read once per isolate.
  const configs = new WeakMap<object, ResolvedObservabilityConfig>();
  return async (request, env, ctx) => {
    const config = resolveConfig(options, env, configs);
    const url = new URL(request.url);
    const parent = TRACEPARENT.exec(request.headers.get("traceparent") ?? "");
    const telemetry: RequestTelemetry = { traceId: parent?.[1] ?? randomHex(16), spanId: randomHex(8), records: pendingRecords.splice(0) };
    const startedAt = Date.now();
    let status: number | undefined;
    let thrown: unknown;
    try {
      const response = await requestStorage.run(telemetry, () => handler(request, env, ctx));
      status = response.status;
      return response;
    } catch (error) {
      thrown = error;
      requestStorage.run(telemetry, () => {
        requestLogger.error("request failed", { error, "http.request.method": request.method, "url.path": url.pathname });
      });
      throw error;
    } finally {
      if (config.kind === "export") {
        const attributes: Record<string, OtlpAttributeValue> = {
          "http.request.method": request.method,
          "url.path": url.pathname,
          "url.scheme": url.protocol.replace(/:$/, ""),
          "server.address": url.hostname,
        };
        if (status !== undefined) attributes["http.response.status_code"] = status;
        const isError = thrown !== undefined || (status ?? 500) >= 500;
        if (isError) attributes["error.type"] = thrown instanceof Error ? thrown.name : String(status ?? "_OTHER");
        const span: OtlpSpan | null = isIgnoredPath(url.pathname)
          ? null
          : {
              scope: SCOPE,
              traceId: telemetry.traceId,
              spanId: telemetry.spanId,
              ...(parent?.[2] === undefined ? {} : { parentSpanId: parent[2] }),
              name: request.method,
              kind: SPAN_KIND_SERVER,
              startTimeUnixNano: toUnixNano(startedAt),
              endTimeUnixNano: toUnixNano(Date.now()),
              attributes,
              statusCode: isError ? STATUS_ERROR : STATUS_UNSET,
            };
        ctx.waitUntil(exportTelemetry(config, telemetry.records, span, options.fetch ?? fetch));
      }
    }
  };
}

/**
 * The Worker's scheduled handler with one span per firing and its log records exported, as `withObservability` does
 * for a request: `export default { scheduled: withScheduledObservability(handler, { serviceName: "shop-jobs" }) }`.
 * The span is named `scheduled`, carries `faas.trigger` (`timer`) and `faas.cron`, and `error.type` when the handler
 * throws (the error is thrown on). The export waits for the handler's promise, so records of work it awaits are sent;
 * work it only hands to `ctx.waitUntil` and does not await is not.
 */
export function withScheduledObservability<Env, Result = unknown>(
  handler: WorkersScheduledHandler<Env, Result>,
  options: WorkersScheduledObservabilityOptions = {},
): WorkersScheduledHandler<Env, Result> {
  configureWorkersLogging(options);
  const configs = new WeakMap<object, ResolvedObservabilityConfig>();
  return async (controller, env, ctx) => {
    const config = resolveConfig(options, env, configs);
    const telemetry: RequestTelemetry = { traceId: randomHex(16), spanId: randomHex(8), records: pendingRecords.splice(0) };
    const startedAt = Date.now();
    let thrown: unknown;
    try {
      return await requestStorage.run(telemetry, () => handler(controller, env, ctx));
    } catch (error) {
      thrown = error;
      requestStorage.run(telemetry, () => {
        requestLogger.error("scheduled run failed", { error, "faas.cron": controller.cron });
      });
      throw error;
    } finally {
      if (config.kind === "export") {
        const attributes: Record<string, OtlpAttributeValue> = { "faas.trigger": "timer", "faas.cron": controller.cron };
        if (thrown !== undefined) attributes["error.type"] = thrown instanceof Error ? thrown.name : "_OTHER";
        const span: OtlpSpan = {
          scope: SCOPE,
          traceId: telemetry.traceId,
          spanId: telemetry.spanId,
          name: "scheduled",
          kind: SPAN_KIND_INTERNAL,
          startTimeUnixNano: toUnixNano(startedAt),
          endTimeUnixNano: toUnixNano(Date.now()),
          attributes,
          statusCode: thrown === undefined ? STATUS_UNSET : STATUS_ERROR,
        };
        ctx.waitUntil(exportTelemetry(config, telemetry.records, span, options.fetch ?? fetch));
      }
    }
  };
}

/** Registers the record collector once and applies the handler's log level and error details. */
function configureWorkersLogging(options: WorkersScheduledObservabilityOptions): void {
  registerLoggerProvider();
  if (options.logLevel !== undefined || options.errorDetails !== undefined) {
    configureLogging({
      ...(options.logLevel === undefined ? {} : { level: options.logLevel }),
      ...(options.errorDetails === undefined ? {} : { errorDetails: options.errorDetails }),
    });
  }
}

type ExportConfig = Extract<ResolvedObservabilityConfig, { kind: "export" }>;

/** Sends the request's records and span; a failed export is reported on the console and never reaches the app. */
async function exportTelemetry(
  config: ExportConfig,
  records: readonly OtlpLogRecord[],
  span: OtlpSpan | null,
  send: typeof fetch,
): Promise<void> {
  const posts: Promise<void>[] = [];
  if (config.logs !== null && records.length > 0) posts.push(post(send, config.logs, "logs", encodeLogs(config.resourceAttributes, records)));
  if (config.traces !== null && span !== null) posts.push(post(send, config.traces, "traces", encodeSpans(config.resourceAttributes, [span])));
  await Promise.all(posts);
}

async function post(send: typeof fetch, target: SignalExport, signal: string, body: string): Promise<void> {
  try {
    const response = await send(target.url, { method: "POST", headers: { ...target.headers, "content-type": "application/json" }, body });
    // The body is drained so the connection is released; its content is the collector's, not worth logging.
    await response.arrayBuffer();
    if (!response.ok) console.error(`observability: the OTLP ${signal} export failed with HTTP ${String(response.status)}`);
  } catch (error) {
    // The URL and headers stay out of the message: the headers carry the collector's credentials.
    console.error(`observability: the OTLP ${signal} export failed (${error instanceof Error ? error.name : typeof error})`);
  }
}

const NO_BINDINGS = {};

/** The export settings from the options and the Worker's string bindings, once per bindings object. */
function resolveConfig(options: WorkersScheduledObservabilityOptions, env: unknown, cache: WeakMap<object, ResolvedObservabilityConfig>): ResolvedObservabilityConfig {
  const key = typeof env === "object" && env !== null ? env : NO_BINDINGS;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  const config = resolveObservabilityConfig({ ...options, lifetime: "short" }, readStringBindings(env));
  for (const warning of config.warnings) console.error(`observability: ${warning}`);
  cache.set(key, config);
  return config;
}

/** `process.env` (populated from bindings under `nodejs_compat`) under the handler's own string bindings. */
function readStringBindings(env: unknown): Environment {
  const result: Record<string, string> = {};
  const sources = [globalThis.process?.env ?? {}, typeof env === "object" && env !== null ? env : {}];
  for (const source of sources) {
    for (const [name, value] of Object.entries(source)) {
      if (typeof value === "string") result[name] = value;
    }
  }
  return result;
}

function randomHex(bytes: number): string {
  const values = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(values, (value) => value.toString(16).padStart(2, "0")).join("");
}

let isProviderRegistered = false;

/** Registers the provider that turns `createLogger` records into OTLP records of the current request. */
function registerLoggerProvider(): void {
  if (isProviderRegistered) return;
  // Refused when another provider registered first (a second copy of the package): that one keeps the records.
  logs.setGlobalLoggerProvider(createRequestLoggerProvider());
  isProviderRegistered = true;
}

function createRequestLoggerProvider(): LoggerProvider {
  return {
    getLogger: (name): OtelLogger => ({
      enabled: () => true,
      emit: (record: LogRecord) => {
        collectRecord(name, record);
      },
    }),
  };
}

function collectRecord(scope: string, record: LogRecord): void {
  const telemetry = requestStorage.getStore();
  const collected: OtlpLogRecord = {
    scope,
    timeUnixNano: toUnixNano(Date.now()),
    severityNumber: record.severityNumber ?? 0,
    severityText: record.severityText ?? "",
    body: typeof record.body === "string" ? record.body : JSON.stringify(record.body ?? ""),
    attributes: toOtlpAttributes(record.attributes),
    ...(telemetry === undefined ? {} : { traceId: telemetry.traceId, spanId: telemetry.spanId }),
  };
  if (telemetry !== undefined) {
    telemetry.records.push(collected);
    return;
  }
  if (pendingRecords.length < MAX_PENDING_RECORDS) pendingRecords.push(collected);
}

function toOtlpAttributes(attributes: LogRecord["attributes"]): Record<string, OtlpAttributeValue> {
  const result: Record<string, OtlpAttributeValue> = {};
  for (const [key, value] of Object.entries(attributes ?? {})) {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") result[key] = value;
    else if (Array.isArray(value)) result[key] = value.map(String);
  }
  return result;
}

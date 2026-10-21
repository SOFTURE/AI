import type { ErrorDetails } from "../errors.js";
import type { LogLevel } from "../levels.js";

export type ObservabilityOptions = {
  /** `service.name`; else `OTEL_SERVICE_NAME`, else `service.name` in `OTEL_RESOURCE_ATTRIBUTES`. */
  serviceName?: string;
  /** `service.namespace`: the project the service belongs to. */
  serviceNamespace?: string;
  /** `service.version`. */
  serviceVersion?: string;
  /**
   * `deployment.environment.name` and `deployment.environment`, e.g. `production`. Both, as
   * `SOFTURE.Common.Observability` (.NET) writes them, so a query on either label matches every service.
   */
  environment?: string;
  /**
   * Base OTLP/HTTP endpoint; `/v1/traces`, `/v1/logs` and `/v1/metrics` are appended. Else
   * `OTEL_EXPORTER_OTLP_ENDPOINT`.
   */
  endpoint?: string;
  /** Headers of every export request; else `OTEL_EXPORTER_OTLP_HEADERS`. Pass secrets from the environment only. */
  headers?: Readonly<Record<string, string>>;
  /** `false` turns export off whatever the endpoint; so does `OTEL_SDK_DISABLED=true`. */
  enabled?: boolean;
  /** What is recorded automatically; see `InstrumentationOptions`. */
  instrumentations?: InstrumentationOptions;
  /** How spans are recorded; see `TraceOptions`. */
  traces?: TraceOptions;
  /** Whether and how often metrics are exported; see `MetricOptions`. */
  metrics?: MetricOptions;
  /** Minimum level of every logger (see `configureLogging`). */
  logLevel?: LogLevel;
  /** How much of an error the loggers record (see `configureLogging`). */
  errorDetails?: ErrorDetails;
  /** Flush on SIGTERM and SIGINT, then let the signal end the process. Default `false`. */
  handleSignals?: boolean;
};

export type InstrumentationOptions = {
  /** Spans for outgoing `fetch` calls (undici). Default `true`; the Next.js adapter defaults it to `false`. */
  fetch?: boolean;
  /**
   * Server spans and the `http.server.request.duration` metric for incoming requests to `node:http`/`node:https`
   * servers (Express, Fastify, plain `http`), plus spans for outgoing `http.request`. Default `true`; the Next.js
   * adapter defaults it to `false`, because Next.js spans its requests itself.
   */
  http?: boolean;
  /** Node.js runtime metrics: event loop delay and utilization, garbage collection, heap. Default `true`. */
  runtime?: boolean;
};

export type MetricOptions = {
  /** `false` exports no metrics; so does `OTEL_METRICS_EXPORTER=none`. Traces and logs stay. Default `true`. */
  enabled?: boolean;
  /** How often the metrics are exported. Default 60 000 ms. */
  exportIntervalMs?: number;
};

export type TraceOptions = {
  /**
   * Paths whose incoming requests get no trace, e.g. `["/api/health"]`: the server span and every span under it are
   * dropped. An entry matches its own path and everything below it as whole segments; the query string is ignored.
   * Every entry starts with `/`.
   */
  ignorePaths?: readonly string[];
  /**
   * Copies the legacy HTTP server attributes onto their stable names when a server span ends: `http.status_code` to
   * `http.response.status_code`, `http.method` to `http.request.method`, `http.target` to `url.path` (without the
   * query). The legacy keys stay. Default `false`; the Next.js adapter defaults it to `true`.
   */
  stableHttpAttributes?: boolean;
};

export type SignalExport = { url: string; headers: Record<string, string> };

/** `warnings`: endpoints that were skipped (an unsupported scheme), naming the source and the scheme only. */
export type ResolvedObservabilityConfig =
  | { kind: "disabled"; reason: string; warnings: string[] }
  | {
      kind: "export";
      traces: SignalExport | null;
      logs: SignalExport | null;
      metrics: SignalExport | null;
      resourceAttributes: Record<string, string>;
      warnings: string[];
    };

export type Environment = Readonly<Record<string, string | undefined>>;

type Signal = "traces" | "logs" | "metrics";

type CheckedUrl = { kind: "url"; url: URL } | { kind: "unsupported"; warning: string };

type ResolvedSignal =
  | { kind: "export"; target: SignalExport }
  | { kind: "none" }
  | { kind: "unsupported"; warning: string };

// A scheme followed by `//`: a value without it (`localhost:4318`) is a mistyped URL, not another transport.
const SCHEME_URL = /^[a-z][a-z0-9+.-]*:\/\//i;

/**
 * Where traces, logs and metrics go and with which resource, from the options first and the standard `OTEL_*` variables
 * second. A base endpoint gets `/v1/<signal>` appended; a per-signal variable (`OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`)
 * is used as given. An endpoint with a scheme other than http(s) (BuildKit's `unix://` trace socket, `grpc://`) is
 * skipped with a warning: telemetry must not stop the program it observes. Errors and warnings name the option or
 * variable, never its value.
 */
export function resolveObservabilityConfig(
  options: ObservabilityOptions,
  env: Environment,
): ResolvedObservabilityConfig {
  if (options.enabled === false) {
    return { kind: "disabled", reason: "enabled: false", warnings: [] };
  }
  if (readEnv(env, "OTEL_SDK_DISABLED")?.toLowerCase() === "true") {
    return { kind: "disabled", reason: "OTEL_SDK_DISABLED", warnings: [] };
  }

  const traces = resolveSignal("traces", options, env);
  const logs = resolveSignal("logs", options, env);
  const metrics: ResolvedSignal = isMetricExportOff(options, env)
    ? { kind: "none" }
    : resolveSignal("metrics", options, env);
  const signals = [traces, logs, metrics];
  // One shared endpoint skipped for every signal is one warning.
  const warnings = [
    ...new Set(signals.flatMap((signal) => (signal.kind === "unsupported" ? [signal.warning] : []))),
  ];
  if (signals.every((signal) => signal.kind !== "export")) {
    return { kind: "disabled", reason: warnings.length === 0 ? "no OTLP endpoint" : warnings.join("; "), warnings };
  }

  return {
    kind: "export",
    traces: traces.kind === "export" ? traces.target : null,
    logs: logs.kind === "export" ? logs.target : null,
    metrics: metrics.kind === "export" ? metrics.target : null,
    resourceAttributes: resolveResourceAttributes(options, env),
    warnings,
  };
}

function isMetricExportOff(options: ObservabilityOptions, env: Environment): boolean {
  return options.metrics?.enabled === false || readEnv(env, "OTEL_METRICS_EXPORTER")?.toLowerCase() === "none";
}

function resolveSignal(signal: Signal, options: ObservabilityOptions, env: Environment): ResolvedSignal {
  const signalKey = `OTEL_EXPORTER_OTLP_${signal.toUpperCase()}`;
  const resolved = resolveSignalUrl(signal, signalKey, options, env);
  if (resolved === null) {
    return { kind: "none" };
  }
  if (resolved.kind === "unsupported") {
    return resolved;
  }
  const url = resolved.url;

  // Merged per key, the way the OTLP exporters merge them anyway: per-signal over shared, options over both.
  const sharedHeaders = parseKeyValueList(readEnv(env, "OTEL_EXPORTER_OTLP_HEADERS"), "OTEL_EXPORTER_OTLP_HEADERS");
  const signalHeaders = parseKeyValueList(readEnv(env, `${signalKey}_HEADERS`), `${signalKey}_HEADERS`);

  return { kind: "export", target: { url, headers: { ...sharedHeaders, ...signalHeaders, ...options.headers } } };
}

// A per-signal variable with an unsupported scheme does not fall back to the base endpoint: it wins by the OTel spec.
function resolveSignalUrl(
  signal: Signal,
  signalKey: string,
  options: ObservabilityOptions,
  env: Environment,
): { kind: "url"; url: string } | { kind: "unsupported"; warning: string } | null {
  const optionEndpoint = options.endpoint?.trim();
  if (optionEndpoint !== undefined && optionEndpoint !== "") {
    return withSignalPath(checkUrl(optionEndpoint, "options.endpoint"), signal);
  }

  const signalEndpoint = readEnv(env, `${signalKey}_ENDPOINT`);
  if (signalEndpoint !== undefined) {
    const checked = checkUrl(signalEndpoint, `${signalKey}_ENDPOINT`);
    return checked.kind === "url" ? { kind: "url", url: checked.url.toString() } : checked;
  }

  const baseEndpoint = readEnv(env, "OTEL_EXPORTER_OTLP_ENDPOINT");
  if (baseEndpoint !== undefined) {
    return withSignalPath(checkUrl(baseEndpoint, "OTEL_EXPORTER_OTLP_ENDPOINT"), signal);
  }

  return null;
}

function withSignalPath(checked: CheckedUrl, signal: Signal) {
  return checked.kind === "url" ? { kind: "url" as const, url: appendSignalPath(checked.url, signal) } : checked;
}

function checkUrl(value: string, source: string): CheckedUrl {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`observability: ${source} is not a URL`);
  }
  if (url.protocol === "http:" || url.protocol === "https:") {
    return { kind: "url", url };
  }
  if (!SCHEME_URL.test(value)) {
    throw new Error(`observability: ${source} is not a URL`);
  }
  const warning = `${source} has the unsupported scheme ${url.protocol} (only http: and https:)`;
  return { kind: "unsupported", warning };
}

// Only the path changes: resolving the path against the origin would read `//host` as another host and drop the
// credentials and the query.
function appendSignalPath(url: URL, signal: Signal): string {
  const result = new URL(url.toString());
  result.pathname = `${url.pathname.replace(/\/+$/, "")}/v1/${signal}`;
  return result.toString();
}

function resolveResourceAttributes(options: ObservabilityOptions, env: Environment): Record<string, string> {
  const attributes = parseKeyValueList(readEnv(env, "OTEL_RESOURCE_ATTRIBUTES"), "OTEL_RESOURCE_ATTRIBUTES");

  const envServiceName = readEnv(env, "OTEL_SERVICE_NAME");
  if (envServiceName !== undefined) {
    attributes["service.name"] = envServiceName;
  }

  setIfPresent(attributes, "service.name", options.serviceName);
  setIfPresent(attributes, "service.namespace", options.serviceNamespace);
  setIfPresent(attributes, "service.version", options.serviceVersion);
  setIfPresent(attributes, "deployment.environment.name", options.environment);
  setIfPresent(attributes, "deployment.environment", options.environment);
  return attributes;
}

function setIfPresent(attributes: Record<string, string>, key: string, value: string | undefined): void {
  const trimmed = value?.trim();
  if (trimmed !== undefined && trimmed !== "") {
    attributes[key] = trimmed;
  }
}

/** `key=value,key2=value2` (the OTel environment format); values are URL-decoded and may contain `=`. */
export function parseKeyValueList(value: string | undefined, source: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (value === undefined) {
    return result;
  }

  for (const member of value.split(",")) {
    if (member.trim() === "") {
      continue;
    }
    const separator = member.indexOf("=");
    const key = separator > 0 ? member.slice(0, separator).trim() : "";
    if (key === "") {
      throw new Error(`observability: ${source} has an entry without a key (expected key=value,key2=value2)`);
    }
    result[key] = decode(member.slice(separator + 1).trim(), source);
  }
  return result;
}

function decode(value: string, source: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new Error(`observability: ${source} has a value that is not valid URL encoding`);
  }
}

function readEnv(env: Environment, name: string): string | undefined {
  const value = env[name]?.trim();
  return value === undefined || value === "" ? undefined : value;
}

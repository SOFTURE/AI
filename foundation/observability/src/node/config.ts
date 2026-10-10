import type { ErrorDetails } from "../errors.js";
import type { LogLevel } from "../levels.js";

export type ObservabilityOptions = {
  /** `service.name`; else `OTEL_SERVICE_NAME`, else `service.name` in `OTEL_RESOURCE_ATTRIBUTES`. */
  serviceName?: string;
  /** `service.namespace`: the project the service belongs to. */
  serviceNamespace?: string;
  /** `service.version`. */
  serviceVersion?: string;
  /** `deployment.environment.name`, e.g. `production`. */
  environment?: string;
  /** Base OTLP/HTTP endpoint; `/v1/traces` and `/v1/logs` are appended. Else `OTEL_EXPORTER_OTLP_ENDPOINT`. */
  endpoint?: string;
  /** Headers of every export request; else `OTEL_EXPORTER_OTLP_HEADERS`. Pass secrets from the environment only. */
  headers?: Readonly<Record<string, string>>;
  /** `false` turns export off whatever the endpoint; so does `OTEL_SDK_DISABLED=true`. */
  enabled?: boolean;
  /** `fetch`: spans for outgoing `fetch` calls (undici). Default `true`; the Next.js adapter defaults it to `false`. */
  instrumentations?: { fetch?: boolean };
  /** Minimum level of every logger (see `configureLogging`). */
  logLevel?: LogLevel;
  /** How much of an error the loggers record (see `configureLogging`). */
  errorDetails?: ErrorDetails;
  /** Flush on SIGTERM and SIGINT, then let the signal end the process. Default `false`. */
  handleSignals?: boolean;
};

export type SignalExport = { url: string; headers: Record<string, string> };

export type ResolvedObservabilityConfig =
  | { kind: "disabled"; reason: string }
  | {
      kind: "export";
      traces: SignalExport | null;
      logs: SignalExport | null;
      resourceAttributes: Record<string, string>;
    };

export type Environment = Readonly<Record<string, string | undefined>>;

type Signal = "traces" | "logs";

/**
 * Where traces and logs go and with which resource, from the options first and the standard `OTEL_*` variables
 * second. A base endpoint gets `/v1/<signal>` appended; a per-signal variable (`OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`)
 * is used as given. Errors name the option or variable that is wrong, never its value.
 */
export function resolveObservabilityConfig(
  options: ObservabilityOptions,
  env: Environment,
): ResolvedObservabilityConfig {
  if (options.enabled === false) {
    return { kind: "disabled", reason: "enabled: false" };
  }
  if (readEnv(env, "OTEL_SDK_DISABLED")?.toLowerCase() === "true") {
    return { kind: "disabled", reason: "OTEL_SDK_DISABLED" };
  }

  const traces = resolveSignal("traces", options, env);
  const logs = resolveSignal("logs", options, env);
  if (traces === null && logs === null) {
    return { kind: "disabled", reason: "no OTLP endpoint" };
  }

  return { kind: "export", traces, logs, resourceAttributes: resolveResourceAttributes(options, env) };
}

function resolveSignal(signal: Signal, options: ObservabilityOptions, env: Environment): SignalExport | null {
  const signalKey = `OTEL_EXPORTER_OTLP_${signal.toUpperCase()}`;
  const url = resolveSignalUrl(signal, signalKey, options, env);
  if (url === null) {
    return null;
  }

  // Merged per key, the way the OTLP exporters merge them anyway: per-signal over shared, options over both.
  const sharedHeaders = parseKeyValueList(readEnv(env, "OTEL_EXPORTER_OTLP_HEADERS"), "OTEL_EXPORTER_OTLP_HEADERS");
  const signalHeaders = parseKeyValueList(readEnv(env, `${signalKey}_HEADERS`), `${signalKey}_HEADERS`);

  return { url, headers: { ...sharedHeaders, ...signalHeaders, ...options.headers } };
}

function resolveSignalUrl(signal: Signal, signalKey: string, options: ObservabilityOptions, env: Environment) {
  const optionEndpoint = options.endpoint?.trim();
  if (optionEndpoint !== undefined && optionEndpoint !== "") {
    return appendSignalPath(checkUrl(optionEndpoint, "options.endpoint"), signal);
  }

  const signalEndpoint = readEnv(env, `${signalKey}_ENDPOINT`);
  if (signalEndpoint !== undefined) {
    return checkUrl(signalEndpoint, `${signalKey}_ENDPOINT`).toString();
  }

  const baseEndpoint = readEnv(env, "OTEL_EXPORTER_OTLP_ENDPOINT");
  if (baseEndpoint !== undefined) {
    return appendSignalPath(checkUrl(baseEndpoint, "OTEL_EXPORTER_OTLP_ENDPOINT"), signal);
  }

  return null;
}

function checkUrl(value: string, source: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`observability: ${source} is not a URL`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`observability: ${source} must be an http(s) URL`);
  }
  return url;
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

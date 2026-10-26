import { createRequire } from "node:module";

import { context, diag, DiagConsoleLogger, DiagLogLevel, metrics, propagation, trace } from "@opentelemetry/api";
import { logs } from "@opentelemetry/api-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-proto";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-proto";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { registerInstrumentations, type Instrumentation } from "@opentelemetry/instrumentation";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { RuntimeNodeInstrumentation } from "@opentelemetry/instrumentation-runtime-node";
import { UndiciInstrumentation } from "@opentelemetry/instrumentation-undici";
import { defaultResource, resourceFromAttributes } from "@opentelemetry/resources";
import { BatchLogRecordProcessor, LoggerProvider } from "@opentelemetry/sdk-logs";
import { MeterProvider, PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { BatchSpanProcessor, NodeTracerProvider } from "@opentelemetry/sdk-trace-node";

import { configureLogging } from "../logger.js";
import { resolveObservabilityConfig, type ObservabilityOptions } from "./config.js";
import { createExportRequestMatcher, type OutgoingRequestTarget } from "./export-request-matcher.js";
import { createIgnoredPathMatcher, createIgnorePathsSampler } from "./ignore-paths-sampler.js";
import { StableHttpAttributesProcessor } from "./stable-http-attributes.js";

export type ObservabilityHandle = {
  /** Whether this process exports traces or logs. */
  readonly isExporting: boolean;
  /** Sends everything buffered so far. */
  forceFlush(): Promise<void>;
  /** Flushes and stops exporting; loggers keep writing to the console. */
  shutdown(): Promise<void>;
};

type Registration = { handle: ObservabilityHandle; dispose: () => Promise<void>; hasWarned: boolean };

// On globalThis, so `next dev` reloads and a second copy of the package find the first registration.
const REGISTRATION_KEY = Symbol.for("softure.observability.registration");

type GlobalWithRegistration = typeof globalThis & { [REGISTRATION_KEY]?: Registration };

const SIGNALS = ["SIGTERM", "SIGINT"] as const;

// Docker sends SIGKILL 10 s after SIGTERM; an unreachable endpoint must not use all of it.
const SIGNAL_FLUSH_TIMEOUT_MS = 5_000;

const DEFAULT_METRIC_EXPORT_INTERVAL_MS = 60_000;

// A query string can carry a reset or unsubscribe token; the server span keeps only the fact that there was one.
const REDACTED_QUERY = { "url.query": "REDACTED" };

// require-in-the-middle hands a module to the first hook that sees it, once per process: a second instance (a restart
// after `shutdown`, the next test) would never get `node:http`. So one instance is kept and re-enabled.
let httpInstrumentation: HttpInstrumentation | undefined;

/**
 * Starts OpenTelemetry for this Node.js process: tracer, logger and meter providers exporting over OTLP/HTTP
 * (protobuf), the resource from the options and `OTEL_*` variables, server spans and the request duration metric for
 * incoming `node:http` requests, spans for outgoing `fetch`, and Node.js runtime metrics. Without an endpoint nothing
 * is registered and the loggers write to the console only. Call it once, as early as possible; later calls return the
 * first handle.
 */
export function startObservability(options: ObservabilityOptions = {}): ObservabilityHandle {
  const global = globalThis as GlobalWithRegistration;
  const existing = global[REGISTRATION_KEY];
  if (existing !== undefined) {
    if (!existing.hasWarned) {
      existing.hasWarned = true;
      console.warn("observability: already started in this process; the first configuration stays");
    }
    return existing.handle;
  }

  configureLogging({
    ...(options.logLevel === undefined ? {} : { level: options.logLevel }),
    ...(options.errorDetails === undefined ? {} : { errorDetails: options.errorDetails }),
  });

  const registration = register(options);
  global[REGISTRATION_KEY] = registration;
  return registration.handle;
}

function register(options: ObservabilityOptions): Registration {
  const config = resolveObservabilityConfig(options, process.env);
  // Built before the disabled check, so a wrong entry fails in development too, not only where export is on.
  const ignorePaths = options.traces?.ignorePaths ?? [];
  const sampler = ignorePaths.length === 0 ? undefined : createIgnorePathsSampler(ignorePaths);
  const isIgnoredPath = createIgnoredPathMatcher(ignorePaths);
  if (config.kind === "disabled") {
    // The reason names the skipped endpoints already, so they get this one line, as a warning.
    const print = config.warnings.length === 0 ? console.log : console.warn;
    print(`observability: export disabled (${config.reason})`);
    return { handle: disabledHandle(), dispose: () => Promise.resolve(), hasWarned: false };
  }

  for (const warning of config.warnings) {
    console.warn(`observability: ${warning}`);
  }
  const resource = defaultResource().merge(resourceFromAttributes(config.resourceAttributes));
  // Failed exports (a wrong token, an unreachable endpoint) would be silent otherwise. Export errors carry the
  // response, never the request headers.
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR);

  const tracerProvider = new NodeTracerProvider({
    resource,
    ...(sampler === undefined ? {} : { sampler }),
    spanProcessors:
      config.traces === null
        ? []
        : [
            ...(options.traces?.stableHttpAttributes === true ? [new StableHttpAttributesProcessor()] : []),
            new BatchSpanProcessor(new OTLPTraceExporter({ url: config.traces.url, headers: config.traces.headers })),
          ],
  });
  // Registered even without trace export: the context manager is what puts trace ids on log records.
  tracerProvider.register();

  const loggerProvider =
    config.logs === null
      ? null
      : new LoggerProvider({
          resource,
          processors: [
            new BatchLogRecordProcessor({
              exporter: new OTLPLogExporter({ url: config.logs.url, headers: config.logs.headers }),
            }),
          ],
        });
  if (loggerProvider !== null) {
    logs.setGlobalLoggerProvider(loggerProvider);
  }

  const meterProvider =
    config.metrics === null
      ? null
      : new MeterProvider({
          resource,
          readers: [
            new PeriodicExportingMetricReader({
              exporter: new OTLPMetricExporter({ url: config.metrics.url, headers: config.metrics.headers }),
              exportIntervalMillis: options.metrics?.exportIntervalMs ?? DEFAULT_METRIC_EXPORT_INTERVAL_MS,
            }),
          ],
        });
  if (meterProvider !== null) {
    metrics.setGlobalMeterProvider(meterProvider);
  }

  const instrumentations: Instrumentation[] = [];
  if (options.instrumentations?.fetch !== false) {
    instrumentations.push(new UndiciInstrumentation());
  }
  if (options.instrumentations?.runtime !== false && meterProvider !== null) {
    instrumentations.push(new RuntimeNodeInstrumentation());
  }
  const unregisterInstrumentations = registerInstrumentations({
    tracerProvider,
    ...(meterProvider === null ? {} : { meterProvider }),
    instrumentations,
  });
  const stopHttpInstrumentation =
    options.instrumentations?.http === false
      ? () => undefined
      : startHttpInstrumentation({
          tracerProvider,
          meterProvider,
          isIgnoredPath,
          isExportRequest: createExportRequestMatcher(
            [config.traces, config.logs, config.metrics].flatMap((signal) => (signal === null ? [] : [signal.url])),
          ),
        });

  const forceFlush = async (): Promise<void> => {
    await Promise.all([tracerProvider.forceFlush(), loggerProvider?.forceFlush(), meterProvider?.forceFlush()]);
  };
  let stopped: Promise<void> | undefined;
  let isExporting = true;
  const shutdown = (): Promise<void> => {
    isExporting = false;
    // Instrumentations stop after the providers: the runtime metrics observe nothing once disabled, and the last
    // collection happens during the meter provider's shutdown.
    stopped ??= (async () => {
      try {
        await Promise.all([tracerProvider.shutdown(), loggerProvider?.shutdown(), meterProvider?.shutdown()]);
      } finally {
        unregisterInstrumentations();
        stopHttpInstrumentation();
      }
    })();
    return stopped;
  };

  const removeSignalHandlers = options.handleSignals === true ? installSignalHandlers(shutdown) : () => undefined;

  const signals = [
    config.traces === null ? null : "traces",
    config.logs === null ? null : "logs",
    config.metrics === null ? null : "metrics",
  ].filter((signal) => signal !== null);
  const target = new URL((config.traces ?? config.logs ?? config.metrics)?.url ?? "").origin;
  const serviceName = String(resource.attributes["service.name"]);
  console.log(`observability: exporting ${joinWords(signals)} to ${target} as ${serviceName}`);

  return {
    handle: {
      get isExporting() {
        return isExporting;
      },
      forceFlush,
      shutdown,
    },
    dispose: async () => {
      removeSignalHandlers();
      await shutdown();
    },
    hasWarned: false,
  };
}

type HttpInstrumentationTarget = {
  tracerProvider: NodeTracerProvider;
  meterProvider: MeterProvider | null;
  isIgnoredPath: (target: string) => boolean;
  isExportRequest: (target: OutgoingRequestTarget) => boolean;
};

function startHttpInstrumentation(target: HttpInstrumentationTarget): () => void {
  const config = {
    ignoreIncomingRequestHook: (request: { url?: string }) => target.isIgnoredPath(request.url ?? ""),
    // The exporter suppresses tracing for its own requests, but not `http.client.request.duration` (issue #810).
    ignoreOutgoingRequestHook: (request: OutgoingRequestTarget) => target.isExportRequest(request),
    startIncomingSpanHook: (request: { url?: string }) => (request.url?.includes("?") === true ? REDACTED_QUERY : {}),
  };
  const instrumentation = httpInstrumentation ?? new HttpInstrumentation({ ...config, enabled: false });
  httpInstrumentation = instrumentation;
  instrumentation.setConfig(config);
  instrumentation.setTracerProvider(target.tracerProvider);
  // Without metric export, the global (no-op) provider, not the one a previous start shut down.
  instrumentation.setMeterProvider(target.meterProvider ?? metrics.getMeterProvider());
  instrumentation.enable();
  loadHttpModules();
  return () => {
    instrumentation.disable();
  };
}

/**
 * The http instrumentation patches `http.Server.prototype.emit` when it sees the module through `require`. An ESM app
 * imports `node:http` before this runs (imports are hoisted) and never requires it again, so the patch would never
 * apply; requiring the modules here applies it, and the prototype is shared with every earlier import.
 */
function loadHttpModules(): void {
  const require = createRequire(import.meta.url);
  require("node:http");
  require("node:https");
}

function joinWords(words: readonly string[]): string {
  return words.length <= 1 ? words.join("") : `${words.slice(0, -1).join(", ")} and ${words.at(-1) ?? ""}`;
}

function disabledHandle(): ObservabilityHandle {
  return { isExporting: false, forceFlush: () => Promise.resolve(), shutdown: () => Promise.resolve() };
}

// Flushes, then re-raises the signal so the default handler ends the process. When the app listens to the signal
// itself, ending the process is the app's job: re-raising would run its listener a second time.
function installSignalHandlers(shutdown: () => Promise<void>): () => void {
  const listeners = SIGNALS.map((signal) => {
    const listener = (): void => {
      void flushWithin(shutdown(), SIGNAL_FLUSH_TIMEOUT_MS).finally(() => {
        if (process.listenerCount(signal) === 0) {
          process.kill(process.pid, signal);
        }
      });
    };
    process.once(signal, listener);
    return [signal, listener] as const;
  });
  return () => {
    for (const [signal, listener] of listeners) {
      process.off(signal, listener);
    }
  };
}

function flushWithin(flush: Promise<void>, timeoutMs: number): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, timeoutMs);
    timer.unref();
  });
  return Promise.race([flush.catch(() => undefined), timeout]).finally(() => clearTimeout(timer));
}

/** Stops the registration and resets every OpenTelemetry global; tests only. */
export async function resetObservabilityForTests(): Promise<void> {
  const global = globalThis as GlobalWithRegistration;
  await global[REGISTRATION_KEY]?.dispose();
  delete global[REGISTRATION_KEY];
  trace.disable();
  logs.disable();
  metrics.disable();
  context.disable();
  propagation.disable();
  diag.disable();
}

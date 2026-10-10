import { context, propagation, trace } from "@opentelemetry/api";
import { logs } from "@opentelemetry/api-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-proto";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { UndiciInstrumentation } from "@opentelemetry/instrumentation-undici";
import { defaultResource, resourceFromAttributes } from "@opentelemetry/resources";
import { BatchLogRecordProcessor, LoggerProvider } from "@opentelemetry/sdk-logs";
import { BatchSpanProcessor, NodeTracerProvider } from "@opentelemetry/sdk-trace-node";

import { configureLogging } from "../logger.js";
import { resolveObservabilityConfig, type ObservabilityOptions } from "./config.js";

export type ObservabilityHandle = {
  /** Whether this process exports traces or logs. */
  readonly isExporting: boolean;
  /** Sends everything buffered so far. */
  forceFlush(): Promise<void>;
  /** Flushes and stops exporting; loggers keep writing to the console. */
  shutdown(): Promise<void>;
};

type Registration = { handle: ObservabilityHandle; dispose: () => Promise<void> };

// On globalThis, so `next dev` reloads and a second copy of the package find the first registration.
const REGISTRATION_KEY = Symbol.for("softure.observability.registration");

type GlobalWithRegistration = typeof globalThis & { [REGISTRATION_KEY]?: Registration };

const SIGNALS = ["SIGTERM", "SIGINT"] as const;

/**
 * Starts OpenTelemetry for this Node.js process: a tracer provider and a logger provider exporting over OTLP/HTTP
 * (protobuf), the resource from the options and `OTEL_*` variables, and spans for outgoing `fetch`. Without an
 * endpoint nothing is registered and the loggers write to the console only. Call it once, as early as possible;
 * later calls return the first handle.
 */
export function startObservability(options: ObservabilityOptions = {}): ObservabilityHandle {
  const global = globalThis as GlobalWithRegistration;
  const existing = global[REGISTRATION_KEY];
  if (existing !== undefined) {
    console.warn("observability: already started in this process; the first configuration stays");
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
  if (config.kind === "disabled") {
    console.log(`observability: export disabled (${config.reason})`);
    return { handle: disabledHandle(), dispose: () => Promise.resolve() };
  }

  const resource = defaultResource().merge(resourceFromAttributes(config.resourceAttributes));

  const tracerProvider = new NodeTracerProvider({
    resource,
    spanProcessors:
      config.traces === null
        ? []
        : [new BatchSpanProcessor(new OTLPTraceExporter({ url: config.traces.url, headers: config.traces.headers }))],
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

  const unregisterInstrumentations =
    options.instrumentations?.fetch === false
      ? () => undefined
      : registerInstrumentations({ tracerProvider, instrumentations: [new UndiciInstrumentation()] });

  const forceFlush = async (): Promise<void> => {
    await Promise.all([tracerProvider.forceFlush(), loggerProvider?.forceFlush()]);
  };
  let stopped: Promise<void> | undefined;
  const shutdown = (): Promise<void> => {
    stopped ??= (async () => {
      unregisterInstrumentations();
      await Promise.all([tracerProvider.shutdown(), loggerProvider?.shutdown()]);
    })();
    return stopped;
  };

  const removeSignalHandlers = options.handleSignals === true ? installSignalHandlers(shutdown) : () => undefined;

  const signals = [config.traces === null ? null : "traces", config.logs === null ? null : "logs"].filter(Boolean);
  const target = new URL((config.traces ?? config.logs)?.url ?? "").origin;
  console.log(
    `observability: exporting ${signals.join(" and ")} to ${target} as ${config.resourceAttributes["service.name"] ?? "unknown_service"}`,
  );

  return {
    handle: { isExporting: true, forceFlush, shutdown },
    dispose: async () => {
      removeSignalHandlers();
      await shutdown();
    },
  };
}

function disabledHandle(): ObservabilityHandle {
  return { isExporting: false, forceFlush: () => Promise.resolve(), shutdown: () => Promise.resolve() };
}

function installSignalHandlers(shutdown: () => Promise<void>): () => void {
  const listeners = SIGNALS.map((signal) => {
    const listener = (): void => {
      void shutdown().finally(() => process.kill(process.pid, signal));
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

/** Stops the registration and resets every OpenTelemetry global; tests only. */
export async function resetObservabilityForTests(): Promise<void> {
  const global = globalThis as GlobalWithRegistration;
  await global[REGISTRATION_KEY]?.dispose();
  delete global[REGISTRATION_KEY];
  trace.disable();
  logs.disable();
  context.disable();
  propagation.disable();
}

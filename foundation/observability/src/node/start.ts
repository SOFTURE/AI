import { context, diag, DiagConsoleLogger, DiagLogLevel, propagation, trace } from "@opentelemetry/api";
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

type Registration = { handle: ObservabilityHandle; dispose: () => Promise<void>; hasWarned: boolean };

// On globalThis, so `next dev` reloads and a second copy of the package find the first registration.
const REGISTRATION_KEY = Symbol.for("softure.observability.registration");

type GlobalWithRegistration = typeof globalThis & { [REGISTRATION_KEY]?: Registration };

const SIGNALS = ["SIGTERM", "SIGINT"] as const;

// Docker sends SIGKILL 10 s after SIGTERM; an unreachable endpoint must not use all of it.
const SIGNAL_FLUSH_TIMEOUT_MS = 5_000;

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
  if (config.kind === "disabled") {
    console.log(`observability: export disabled (${config.reason})`);
    return { handle: disabledHandle(), dispose: () => Promise.resolve(), hasWarned: false };
  }

  const resource = defaultResource().merge(resourceFromAttributes(config.resourceAttributes));
  // Failed exports (a wrong token, an unreachable endpoint) would be silent otherwise. Export errors carry the
  // response, never the request headers.
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR);

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
  let isExporting = true;
  const shutdown = (): Promise<void> => {
    isExporting = false;
    stopped ??= (async () => {
      unregisterInstrumentations();
      await Promise.all([tracerProvider.shutdown(), loggerProvider?.shutdown()]);
    })();
    return stopped;
  };

  const removeSignalHandlers = options.handleSignals === true ? installSignalHandlers(shutdown) : () => undefined;

  const signals = [config.traces === null ? null : "traces", config.logs === null ? null : "logs"].filter(Boolean);
  const target = new URL((config.traces ?? config.logs)?.url ?? "").origin;
  const serviceName = String(resource.attributes["service.name"]);
  console.log(`observability: exporting ${signals.join(" and ")} to ${target} as ${serviceName}`);

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
  context.disable();
  propagation.disable();
  diag.disable();
}

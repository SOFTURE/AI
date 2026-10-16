import { ExportResultCode, type ExportResult } from "@opentelemetry/core";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-proto";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { defaultResource, resourceFromAttributes, type Resource } from "@opentelemetry/resources";
import {
  LoggerProvider,
  SimpleLogRecordProcessor,
  type LogRecordExporter,
  type ReadableLogRecord,
} from "@opentelemetry/sdk-logs";
import {
  BasicTracerProvider,
  SimpleSpanProcessor,
  type ReadableSpan,
  type SpanExporter,
} from "@opentelemetry/sdk-trace-node";

import { resolveObservabilityConfig, type Environment, type ObservabilityOptions, type SignalExport } from "./config.js";

export type ProbeSignal = "traces" | "logs";

export type ProbeSignalResult =
  | { signal: ProbeSignal; outcome: "accepted"; target: string }
  /** `status` is the HTTP status of the refusal; `null` when there was no response (unreachable, timed out). */
  | { signal: ProbeSignal; outcome: "refused"; target: string; status: number | null; problem: string }
  | { signal: ProbeSignal; outcome: "not configured" };

export type ProbeResult =
  | { kind: "disabled"; reason: string }
  /** `isAccepted`: every configured signal was accepted. */
  | { kind: "checked"; isAccepted: boolean; signals: ProbeSignalResult[] };

export type ProbeOptions = ObservabilityOptions & {
  /** How long each export may take, retries included. Default 10 000 ms. */
  timeoutMs?: number;
};

/** The name and the `softure.probe=true` attribute of the probe span and log record, to filter them out of queries. */
export const PROBE_NAME = "softure.probe";

const DEFAULT_TIMEOUT_MS = 10_000;

const PROBE_ATTRIBUTES = { [PROBE_NAME]: true };

/**
 * Sends one span and one log record named `softure.probe` (attribute `softure.probe=true`) to the endpoint that
 * `startObservability` would use, from the same options and `OTEL_*` variables, and says per signal whether the
 * backend accepted it. It uses providers of its own, so a running app's export is left alone. Export headers are
 * never part of the result.
 */
export async function probeObservability(
  options: ProbeOptions = {},
  env: Environment = process.env,
): Promise<ProbeResult> {
  const config = resolveObservabilityConfig(options, env);
  if (config.kind === "disabled") {
    return { kind: "disabled", reason: config.reason };
  }

  const resource = defaultResource().merge(resourceFromAttributes(config.resourceAttributes));
  const timeoutMillis = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const signals = await Promise.all([
    config.traces === null
      ? notConfigured("traces")
      : probeTraces(config.traces, resource, timeoutMillis),
    config.logs === null ? notConfigured("logs") : probeLogs(config.logs, resource, timeoutMillis),
  ]);
  const isAccepted = signals.every((result) => result.outcome !== "refused");
  return { kind: "checked", isAccepted, signals };
}

function notConfigured(signal: ProbeSignal): Promise<ProbeSignalResult> {
  return Promise.resolve({ signal, outcome: "not configured" });
}

async function probeTraces(target: SignalExport, resource: Resource, timeoutMillis: number) {
  const capture = captureFirstExport<ReadableSpan>(
    new OTLPTraceExporter({ url: target.url, headers: target.headers, timeoutMillis }),
  );
  const provider = new BasicTracerProvider({ resource, spanProcessors: [new SimpleSpanProcessor(capture.exporter)] });
  provider.getTracer(PROBE_NAME).startSpan(PROBE_NAME, { attributes: PROBE_ATTRIBUTES }).end();
  const result = await capture.result;
  await provider.shutdown();
  return toSignalResult("traces", target, result);
}

async function probeLogs(target: SignalExport, resource: Resource, timeoutMillis: number) {
  const capture = captureFirstExport<ReadableLogRecord>(
    new OTLPLogExporter({ url: target.url, headers: target.headers, timeoutMillis }),
  );
  const provider = new LoggerProvider({ resource, processors: [new SimpleLogRecordProcessor({ exporter: capture.exporter })] });
  provider.getLogger(PROBE_NAME).emit({ body: PROBE_NAME, severityText: "info", attributes: PROBE_ATTRIBUTES });
  const result = await capture.result;
  await provider.shutdown();
  return toSignalResult("logs", target, result);
}

type Exporter<T> = {
  export(items: T[], resultCallback: (result: ExportResult) => void): void;
  shutdown(): Promise<void>;
  forceFlush?(): Promise<void>;
};

/** Forwards to `exporter` and resolves with the result of the first export. */
function captureFirstExport<T>(exporter: Exporter<T>): {
  exporter: Exporter<T> & SpanExporter & LogRecordExporter;
  result: Promise<ExportResult>;
} {
  let resolveResult: (result: ExportResult) => void = () => undefined;
  const result = new Promise<ExportResult>((resolve) => {
    resolveResult = resolve;
  });
  const capturing = {
    export(items: T[], resultCallback: (exported: ExportResult) => void): void {
      exporter.export(items, (exported) => {
        resolveResult(exported);
        resultCallback(exported);
      });
    },
    shutdown: () => exporter.shutdown(),
    forceFlush: () => exporter.forceFlush?.() ?? Promise.resolve(),
  };
  // One object serves both signal types; each provider only calls it with its own records.
  return { exporter: capturing as Exporter<T> & SpanExporter & LogRecordExporter, result };
}

function toSignalResult(signal: ProbeSignal, target: SignalExport, result: ExportResult): ProbeSignalResult {
  const shownTarget = describeTarget(target.url);
  if (result.code === ExportResultCode.SUCCESS) {
    return { signal, outcome: "accepted", target: shownTarget };
  }
  return {
    signal,
    outcome: "refused",
    target: shownTarget,
    status: readStatus(result.error),
    problem: result.error?.message ?? "export failed",
  };
}

function readStatus(error: Error | undefined): number | null {
  const code = (error as { code?: unknown } | undefined)?.code;
  return typeof code === "number" ? code : null;
}

// Origin and path only: an endpoint can carry credentials in its userinfo or its query.
function describeTarget(url: string): string {
  const parsed = new URL(url);
  return `${parsed.origin}${parsed.pathname}`;
}

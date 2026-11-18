import { SpanKind, type Histogram, type Meter } from "@opentelemetry/api";
import { hrTimeToMilliseconds } from "@opentelemetry/core";
import type { ReadableSpan, SpanProcessor } from "@opentelemetry/sdk-trace";

/** The histogram's name, as the http instrumentation names it; a Prometheus backend reads `http_server_request_duration_seconds`. */
export const SERVER_SPAN_METRIC_NAME = "http.server.request.duration";

/** Bucket boundaries in seconds, the semantic conventions' advice for this histogram. */
const BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1, 2.5, 5, 7.5, 10];

/**
 * Records `http.server.request.duration` from the server spans another library already makes (Next.js spans every
 * request itself, so the http instrumentation is off there and no request metric exists otherwise). Only a span with
 * no local parent counts, so one request is one measurement. The attributes are the method, the status code and the
 * route when the span has one (`http.route`, else Next.js's `next.route`), never the path, so the series stay few.
 * A span the sampler dropped never reaches a processor: a path in `traces.ignorePaths` is not measured.
 */
export class ServerSpanMetricsProcessor implements SpanProcessor {
  private readonly duration: Histogram;

  constructor(meter: Meter) {
    this.duration = meter.createHistogram(SERVER_SPAN_METRIC_NAME, {
      unit: "s",
      description: "Duration of HTTP server requests, from the server spans",
      advice: { explicitBucketBoundaries: BUCKETS },
    });
  }

  onStart(): void {
    // Nothing to do: the status code is known only when the span ends.
  }

  onEnd(span: ReadableSpan): void {
    if (span.kind !== SpanKind.SERVER) return;
    const parent = span.parentSpanContext;
    if (parent !== undefined && parent.isRemote !== true) return;
    const method = readAttribute(span, "http.request.method", "http.method");
    const status = readAttribute(span, "http.response.status_code", "http.status_code");
    const route = readAttribute(span, "http.route", "next.route");
    this.duration.record(hrTimeToMilliseconds(span.duration) / 1000, {
      "http.request.method": typeof method === "string" ? method : "_OTHER",
      ...(status === undefined ? {} : { "http.response.status_code": Number(status) }),
      ...(typeof route === "string" ? { "http.route": route } : {}),
    });
  }

  forceFlush(): Promise<void> {
    return Promise.resolve();
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}

function readAttribute(span: ReadableSpan, stable: string, legacy: string): string | number | undefined {
  const value = span.attributes[stable] ?? span.attributes[legacy];
  return typeof value === "string" || typeof value === "number" ? value : undefined;
}

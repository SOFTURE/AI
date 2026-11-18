import { context, SpanKind, trace, type Attributes } from "@opentelemetry/api";
import {
  AggregationTemporality,
  InMemoryMetricExporter,
  MeterProvider,
  PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics";
import { TracerProvider } from "@opentelemetry/sdk-trace";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { SERVER_SPAN_METRIC_NAME } from "../src/node/index.js";
import { ServerSpanMetricsProcessor } from "../src/node/server-span-metrics.js";

type Recorded = { readonly count: number; readonly attributes: Attributes };

let exporter: InMemoryMetricExporter;
let reader: PeriodicExportingMetricReader;
let meterProvider: MeterProvider;
let tracerProvider: TracerProvider;

beforeEach(() => {
  exporter = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE);
  reader = new PeriodicExportingMetricReader({
    exporter,
    exportIntervalMillis: 3_600_000,
  });
  meterProvider = new MeterProvider({ readers: [reader] });
  tracerProvider = new TracerProvider({
    spanProcessors: [new ServerSpanMetricsProcessor(meterProvider.getMeter("test"))],
  });
});

afterEach(async () => {
  await Promise.all([tracerProvider.shutdown(), meterProvider.shutdown()]);
});

async function collect(): Promise<Recorded[]> {
  await reader.forceFlush();
  const recorded: Recorded[] = [];
  for (const batch of exporter.getMetrics()) {
    for (const scope of batch.scopeMetrics) {
      for (const metric of scope.metrics) {
        expect(metric.descriptor.name).toBe(SERVER_SPAN_METRIC_NAME);
        expect(metric.descriptor.unit).toBe("s");
        for (const point of metric.dataPoints) {
          recorded.push({
            count: (point.value as { count: number }).count,
            attributes: point.attributes,
          });
        }
      }
    }
  }
  return recorded;
}

function endSpan(kind: SpanKind, attributes: Attributes): void {
  tracerProvider.getTracer("next.js").startSpan("request", { kind, attributes }).end();
}

describe("ServerSpanMetricsProcessor", () => {
  it("records a server span with its stable method, status code and route", async () => {
    endSpan(SpanKind.SERVER, {
      "http.request.method": "POST",
      "http.response.status_code": 201,
      "http.route": "/api/reels",
      "url.path": "/api/reels",
    });

    expect(await collect()).toEqual([
      {
        count: 1,
        attributes: {
          "http.request.method": "POST",
          "http.response.status_code": 201,
          "http.route": "/api/reels",
        },
      },
    ]);
  });

  it("falls back to Next.js's legacy attributes and its next.route, and never uses the path", async () => {
    endSpan(SpanKind.SERVER, {
      "http.method": "GET",
      "http.status_code": "500",
      "next.route": "/reels/[id]",
      "http.target": "/reels/42?token=x",
    });

    expect(await collect()).toEqual([
      {
        count: 1,
        attributes: {
          "http.request.method": "GET",
          "http.response.status_code": 500,
          "http.route": "/reels/[id]",
        },
      },
    ]);
  });

  it("names an unknown method _OTHER and leaves out a missing status code and route", async () => {
    endSpan(SpanKind.SERVER, { "http.method": true });

    expect(await collect()).toEqual([{ count: 1, attributes: { "http.request.method": "_OTHER" } }]);
  });

  it("ignores client and internal spans, and a server span under a local parent", async () => {
    endSpan(SpanKind.CLIENT, { "http.method": "GET" });
    endSpan(SpanKind.INTERNAL, { "http.method": "GET" });
    const tracer = tracerProvider.getTracer("next.js");
    const parent = tracer.startSpan("outer", {
      kind: SpanKind.SERVER,
      attributes: { "http.method": "GET" },
    });
    tracer
      .startSpan(
        "inner",
        { kind: SpanKind.SERVER, attributes: { "http.method": "PUT" } },
        trace.setSpan(context.active(), parent),
      )
      .end();
    parent.end();

    expect(await collect()).toEqual([{ count: 1, attributes: { "http.request.method": "GET" } }]);
  });

  it("records a server span whose parent came from another process", async () => {
    const remoteParent = trace.wrapSpanContext({
      traceId: "0af7651916cd43dd8448eb211c80319c",
      spanId: "b7ad6b7169203331",
      traceFlags: 1,
      isRemote: true,
    });
    tracerProvider
      .getTracer("next.js")
      .startSpan(
        "request",
        { kind: SpanKind.SERVER, attributes: { "http.method": "GET" } },
        trace.setSpan(context.active(), remoteParent),
      )
      .end();

    expect(await collect()).toEqual([{ count: 1, attributes: { "http.request.method": "GET" } }]);
  });
});

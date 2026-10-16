import { context, SpanKind, trace } from "@opentelemetry/api";
import { BasicTracerProvider, InMemorySpanExporter, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-node";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { startObservability } from "../src/node/index.js";
import { createIgnorePathsSampler } from "../src/node/ignore-paths-sampler.js";
import { resetObservabilityForTests } from "../src/node/start.js";
import { startOtlpReceiver, type OtlpReceiver } from "./otlp-receiver.js";

function createTracer(paths: readonly string[]) {
  const exporter = new InMemorySpanExporter();
  const provider = new BasicTracerProvider({
    sampler: createIgnorePathsSampler(paths),
    spanProcessors: [new SimpleSpanProcessor(exporter)],
  });
  return { tracer: provider.getTracer("test"), exporter };
}

function getExportedNames(exporter: InMemorySpanExporter): string[] {
  return exporter.getFinishedSpans().map((span) => span.name);
}

describe("createIgnorePathsSampler", () => {
  it.each([
    ["/api/health", "http.target"],
    ["/api/health?probe=1", "http.target"],
    ["/api/health/live", "http.target"],
    ["/api/health", "url.path"],
  ])("drops the server span of %j given as %s", (path, key) => {
    const { tracer, exporter } = createTracer(["/api/health"]);

    tracer.startSpan("GET", { kind: SpanKind.SERVER, attributes: { [key]: path } }).end();

    expect(getExportedNames(exporter)).toEqual([]);
  });

  it.each(["/api/healthz", "/api", "/orders"])("keeps the server span of %j", (path) => {
    const { tracer, exporter } = createTracer(["/api/health"]);

    tracer.startSpan("GET", { kind: SpanKind.SERVER, attributes: { "http.target": path } }).end();

    expect(getExportedNames(exporter)).toEqual(["GET"]);
  });

  it("drops the child spans of a dropped request", () => {
    const { tracer, exporter } = createTracer(["/api/health"]);

    const root = tracer.startSpan("GET", { kind: SpanKind.SERVER, attributes: { "http.target": "/api/health" } });
    tracer.startSpan("db query", {}, trace.setSpan(context.active(), root)).end();
    root.end();

    expect(getExportedNames(exporter)).toEqual([]);
  });

  it("keeps a client span to an ignored path", () => {
    const { tracer, exporter } = createTracer(["/api/health"]);

    tracer.startSpan("fetch", { kind: SpanKind.CLIENT, attributes: { "url.path": "/api/health" } }).end();

    expect(getExportedNames(exporter)).toEqual(["fetch"]);
  });

  it.each(["/api/health/", "/api/health///"])("treats trailing slashes on the entry %j like none", (entry) => {
    const { tracer, exporter } = createTracer([entry]);

    tracer.startSpan("GET", { kind: SpanKind.SERVER, attributes: { "http.target": "/api/health" } }).end();

    expect(getExportedNames(exporter)).toEqual([]);
  });

  it("keeps a server span without a path attribute", () => {
    const { tracer, exporter } = createTracer(["/"]);

    tracer.startSpan("job", { kind: SpanKind.SERVER }).end();

    expect(getExportedNames(exporter)).toEqual(["job"]);
  });

  it("names the entry that is not a path", () => {
    expect(() => createIgnorePathsSampler(["/ok", "api/health"])).toThrow(
      "observability: traces.ignorePaths[1] must be a path starting with /",
    );
  });
});

describe("traces.ignorePaths in startObservability", () => {
  let receiver: OtlpReceiver | undefined;

  beforeEach(() => {
    for (const method of ["log", "error", "warn"] as const) {
      vi.spyOn(console, method).mockImplementation(() => undefined);
    }
    for (const name of Object.keys(process.env).filter((key) => key.startsWith("OTEL_"))) {
      delete process.env[name];
    }
  });

  afterEach(async () => {
    await resetObservabilityForTests();
    await receiver?.close();
    receiver = undefined;
    vi.restoreAllMocks();
  });

  it("exports the other requests and not the ignored one", async () => {
    receiver = await startOtlpReceiver();
    const handle = startObservability({
      serviceName: "my-service",
      endpoint: receiver.url,
      traces: { ignorePaths: ["/api/health"] },
    });

    const tracer = trace.getTracer("next.js");
    tracer.startSpan("GET /api/health", { kind: SpanKind.SERVER, attributes: { "http.target": "/api/health" } }).end();
    tracer.startSpan("GET /orders", { kind: SpanKind.SERVER, attributes: { "http.target": "/orders" } }).end();
    await handle.forceFlush();

    const body = receiver.bodyOf("/v1/traces");
    expect(body.includes("GET /orders")).toBe(true);
    expect(body.includes("GET /api/health")).toBe(false);
  });

  it("fails at start-up on an entry that is not a path, even without an endpoint", () => {
    expect(() => startObservability({ traces: { ignorePaths: ["health"] } })).toThrow(
      "observability: traces.ignorePaths[0] must be a path starting with /",
    );
  });
});

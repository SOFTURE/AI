import { SpanKind, trace } from "@opentelemetry/api";
import { BasicTracerProvider, InMemorySpanExporter, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-node";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { registerObservability } from "../src/next/index.js";
import { startObservability } from "../src/node/index.js";
import { getPath, StableHttpAttributesProcessor } from "../src/node/stable-http-attributes.js";
import { resetObservabilityForTests } from "../src/node/start.js";
import { startOtlpReceiver, type OtlpReceiver } from "./otlp-receiver.js";

function createTracer() {
  const exporter = new InMemorySpanExporter();
  const provider = new BasicTracerProvider({
    spanProcessors: [new StableHttpAttributesProcessor(), new SimpleSpanProcessor(exporter)],
  });
  return { tracer: provider.getTracer("test"), exporter };
}

describe("StableHttpAttributesProcessor", () => {
  it("copies the legacy server attributes onto their stable names and keeps the legacy keys", () => {
    const { tracer, exporter } = createTracer();

    const span = tracer.startSpan("GET /orders", {
      kind: SpanKind.SERVER,
      attributes: { "http.method": "GET", "http.target": "/orders?token=secret" },
    });
    span.setAttribute("http.status_code", 503);
    span.end();

    expect(exporter.getFinishedSpans()[0]?.attributes).toEqual({
      "http.method": "GET",
      "http.request.method": "GET",
      "http.target": "/orders?token=secret",
      "url.path": "/orders",
      "http.status_code": 503,
      "http.response.status_code": 503,
    });
  });

  it("keeps a stable key the span already has", () => {
    const { tracer, exporter } = createTracer();

    const span = tracer.startSpan("GET /", {
      kind: SpanKind.SERVER,
      attributes: { "http.status_code": 500, "http.response.status_code": 502, "http.target": "/a", "url.path": "/b" },
    });
    span.end();

    const attributes = exporter.getFinishedSpans()[0]?.attributes;
    expect(attributes?.["http.response.status_code"]).toBe(502);
    expect(attributes?.["url.path"]).toBe("/b");
  });

  it("leaves a client span untouched", () => {
    const { tracer, exporter } = createTracer();

    const span = tracer.startSpan("fetch", { kind: SpanKind.CLIENT, attributes: { "http.method": "POST" } });
    span.setAttribute("http.status_code", 201);
    span.end();

    expect(exporter.getFinishedSpans()[0]?.attributes).toEqual({ "http.method": "POST", "http.status_code": 201 });
  });

  it("adds nothing to a server span without HTTP attributes", () => {
    const { tracer, exporter } = createTracer();

    tracer.startSpan("job", { kind: SpanKind.SERVER }).end();

    expect(exporter.getFinishedSpans()[0]?.attributes).toEqual({});
  });
});

describe("getPath", () => {
  it.each([
    ["/orders?token=secret", "/orders"],
    ["/", "/"],
    ["http://example.com/a/b?c=1", "/a/b"],
    ["", "/"],
  ])("reads the path of %j as %j", (target, path) => {
    expect(getPath(target)).toBe(path);
  });
});

describe("traces.stableHttpAttributes", () => {
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

  function endServerSpan(): void {
    trace
      .getTracer("next.js")
      .startSpan("GET /orders", { kind: SpanKind.SERVER, attributes: { "http.method": "GET" } })
      .end();
  }

  it("is on by default in registerObservability", async () => {
    receiver = await startOtlpReceiver();
    const handle = await registerObservability({ serviceName: "my-service", endpoint: receiver.url });

    endServerSpan();
    await handle?.forceFlush();

    expect(receiver.bodyOf("/v1/traces").includes("http.request.method")).toBe(true);
  });

  it("is off when registerObservability gets false", async () => {
    receiver = await startOtlpReceiver();
    const handle = await registerObservability({
      serviceName: "my-service",
      endpoint: receiver.url,
      traces: { stableHttpAttributes: false },
    });

    endServerSpan();
    await handle?.forceFlush();

    const body = receiver.bodyOf("/v1/traces");
    expect(body.includes("GET /orders")).toBe(true);
    expect(body.includes("http.request.method")).toBe(false);
  });

  it("is off by default in startObservability", async () => {
    receiver = await startOtlpReceiver();
    const handle = startObservability({ serviceName: "my-service", endpoint: receiver.url });

    endServerSpan();
    await handle.forceFlush();

    const body = receiver.bodyOf("/v1/traces");
    expect(body.includes("GET /orders")).toBe(true);
    expect(body.includes("http.request.method")).toBe(false);
  });
});

import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { trace } from "@opentelemetry/api";
import { logs } from "@opentelemetry/api-logs";
import { LoggerProvider } from "@opentelemetry/sdk-logs";
import { BasicTracerProvider } from "@opentelemetry/sdk-trace-node";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createLogger } from "../src/index.js";
import { startObservability } from "../src/node/index.js";
import { resetObservabilityForTests } from "../src/node/start.js";
import { startOtlpReceiver, type OtlpReceiver } from "./otlp-receiver.js";

const AUTHORIZATION = "Basic c2VjcmV0LWluc3RhbmNlOnNlY3JldC10b2tlbg==";

let output: string[];
let receiver: OtlpReceiver | undefined;
let app: Server | undefined;

beforeEach(() => {
  output = [];
  for (const method of ["log", "error", "warn", "info", "debug"] as const) {
    vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
      output.push(args.map(String).join(" "));
    });
  }
  for (const name of Object.keys(process.env).filter((key) => key.startsWith("OTEL_"))) {
    delete process.env[name];
  }
});

afterEach(async () => {
  await resetObservabilityForTests();
  await receiver?.close();
  receiver = undefined;
  app?.closeAllConnections();
  await new Promise<void>((resolve) => (app === undefined ? resolve() : app.close(() => resolve())));
  app = undefined;
  vi.restoreAllMocks();
});

// An app server on a random local port, created from the `node:http` imported above, before observability starts.
async function startApp(): Promise<string> {
  app = createServer((request, response) => {
    response.statusCode = request.url?.startsWith("/missing") === true ? 404 : 200;
    response.end("ok");
  });
  await new Promise<void>((resolve) => app?.listen(0, "127.0.0.1", resolve));
  const { port } = app.address() as AddressInfo;
  return `http://127.0.0.1:${String(port)}`;
}

async function get(url: string): Promise<void> {
  const response = await fetch(url);
  await response.arrayBuffer();
}

describe("startObservability without an endpoint", () => {
  it("registers no provider and the logger still writes to the console", () => {
    const handle = startObservability({ serviceName: "my-service" });

    createLogger("orders").info("console only");

    expect(handle.isExporting).toBe(false);
    // Nothing is registered, so the first registration of a probe provider succeeds.
    expect(trace.setGlobalTracerProvider(new BasicTracerProvider())).toBe(true);
    const probeLoggerProvider = new LoggerProvider();
    expect(logs.setGlobalLoggerProvider(probeLoggerProvider)).toBe(probeLoggerProvider);
    expect(output).toContain("observability: export disabled (no OTLP endpoint)");
    expect(output).toContain("info orders: console only");
  });
});

describe("startObservability with an endpoint it cannot export to", () => {
  it("does not throw on BuildKit's unix:// trace socket, warns once and exports nothing", () => {
    process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT = "unix:///dev/otel-grpc.sock";

    const handle = startObservability({ serviceName: "my-service" });

    expect(handle.isExporting).toBe(false);
    expect(output).toEqual([
      "observability: export disabled (OTEL_EXPORTER_OTLP_TRACES_ENDPOINT has the unsupported scheme unix: " +
        "(only http: and https:))",
    ]);
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it("warns about the skipped signal and keeps exporting the other one", async () => {
    receiver = await startOtlpReceiver();
    process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT = "unix:///dev/otel-grpc.sock";
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = `${receiver.url}/otlp`;

    const handle = startObservability({ serviceName: "my-service" });

    expect(handle.isExporting).toBe(true);
    expect(output).toContain(
      "observability: OTEL_EXPORTER_OTLP_TRACES_ENDPOINT has the unsupported scheme unix: (only http: and https:)",
    );
    expect(output).toContain(`observability: exporting logs and metrics to ${receiver.url} as my-service`);
  });
});

describe("startObservability with an endpoint", () => {
  it("exports traces, logs and fetch spans over OTLP/HTTP protobuf with the auth header", async () => {
    receiver = await startOtlpReceiver();
    const handle = startObservability({
      serviceName: "my-service",
      serviceNamespace: "my-project",
      environment: "test",
      endpoint: `${receiver.url}/otlp`,
      headers: { Authorization: AUTHORIZATION },
    });

    trace.getTracer("test").startActiveSpan("checkout", (span) => {
      createLogger("orders").info("inside the span", { orderId: 7 });
      span.end();
    });
    const response = await fetch(`${receiver.url}/ping`);
    await response.arrayBuffer();
    await handle.forceFlush();

    const exports = receiver.requests.filter((request) => request.path.startsWith("/otlp/"));
    const paths = exports.map((request) => request.path).sort();
    expect(paths).toContain("/otlp/v1/traces");
    expect(paths).toContain("/otlp/v1/logs");
    for (const request of exports) {
      expect(request.method).toBe("POST");
      expect(request.headers["content-type"]).toBe("application/x-protobuf");
      expect(request.headers.authorization).toBe(AUTHORIZATION);
    }
    const traceBodies = Buffer.concat(exports.filter((r) => r.path === "/otlp/v1/traces").map((r) => r.body));
    expect(traceBodies.includes("checkout")).toBe(true);
    expect(traceBodies.includes(`${receiver.url}/ping`)).toBe(true);
    expect(traceBodies.includes("my-project")).toBe(true);
    const logBodies = Buffer.concat(exports.filter((r) => r.path === "/otlp/v1/logs").map((r) => r.body));
    expect(logBodies.includes("inside the span")).toBe(true);
    expect(handle.isExporting).toBe(true);
  });

  it("never writes the auth header to the console", async () => {
    receiver = await startOtlpReceiver();
    process.env.OTEL_EXPORTER_OTLP_HEADERS = `Authorization=${encodeURIComponent(AUTHORIZATION)}`;
    const handle = startObservability({ serviceName: "my-service", endpoint: receiver.url });

    createLogger("orders").error("failed", { error: new Error("boom") });
    await handle.forceFlush();

    expect(output).toContain(`observability: exporting traces, logs and metrics to ${receiver.url} as my-service`);
    expect(output.join("\n")).not.toContain("c2VjcmV0");
    expect(output.join("\n")).not.toContain("secret");
  });

  it("returns the first handle on a second call in the same process", async () => {
    receiver = await startOtlpReceiver();
    const first = startObservability({ serviceName: "my-service", endpoint: receiver.url });

    const second = startObservability({ serviceName: "other", endpoint: receiver.url });
    const third = startObservability({ serviceName: "other", endpoint: receiver.url });

    expect(second).toBe(first);
    expect(third).toBe(first);
    expect(output.filter((line) => line.includes("already started"))).toHaveLength(1);
  });

  it("keeps logging without throwing after shutdown", async () => {
    receiver = await startOtlpReceiver();
    const handle = startObservability({ serviceName: "my-service", endpoint: receiver.url });

    await handle.shutdown();

    expect(handle.isExporting).toBe(false);
    expect(() => createLogger("orders").info("after shutdown")).not.toThrow();
    expect(output).toContain("info orders: after shutdown");
  });
});

describe("startObservability: incoming HTTP requests", () => {
  // The receiver is an http server in this process too; its export requests are kept out of the traces.
  const OTLP_PATH = "/otlp";

  it("records a server span for a server created before start, with the query string redacted", async () => {
    receiver = await startOtlpReceiver();
    const appUrl = await startApp();
    const handle = startObservability({
      serviceName: "my-service",
      endpoint: `${receiver.url}${OTLP_PATH}`,
      instrumentations: { fetch: false },
      traces: { ignorePaths: [OTLP_PATH] },
    });

    await get(`${appUrl}/missing/7?token=secret-reset-token`);
    await handle.forceFlush();

    const traces = receiver.bodyOf("/otlp/v1/traces");
    expect(traces.includes("/missing/7")).toBe(true);
    expect(traces.includes("http.response.status_code")).toBe(true);
    expect(traces.includes("REDACTED")).toBe(true);
    expect(traces.includes("secret-reset-token")).toBe(false);
    expect(traces.includes(OTLP_PATH)).toBe(false);
  });

  it("puts the trace id of the server span on the logs written while handling the request", async () => {
    receiver = await startOtlpReceiver();
    const handle = startObservability({
      serviceName: "my-service",
      endpoint: `${receiver.url}${OTLP_PATH}`,
      instrumentations: { fetch: false },
      traces: { ignorePaths: [OTLP_PATH] },
    });
    let traceId: string | undefined;
    app = createServer((_request, response) => {
      traceId = trace.getActiveSpan()?.spanContext().traceId;
      createLogger("orders").info("handling the request");
      response.end("ok");
    });
    await new Promise<void>((resolve) => app?.listen(0, "127.0.0.1", resolve));
    const { port } = app.address() as AddressInfo;

    await get(`http://127.0.0.1:${String(port)}/orders`);
    await handle.forceFlush();

    expect(traceId).toMatch(/^[0-9a-f]{32}$/);
    const logs = receiver.bodyOf("/otlp/v1/logs");
    expect(logs.includes("handling the request")).toBe(true);
    expect(logs.includes(Buffer.from(traceId ?? "", "hex"))).toBe(true);
  });

  it("records neither a span nor a duration for a path in traces.ignorePaths", async () => {
    receiver = await startOtlpReceiver();
    const appUrl = await startApp();
    const handle = startObservability({
      serviceName: "my-service",
      endpoint: `${receiver.url}${OTLP_PATH}`,
      instrumentations: { fetch: false },
      traces: { ignorePaths: [OTLP_PATH, "/api/health"] },
    });

    await get(`${appUrl}/api/health/live`);
    await handle.forceFlush();

    expect(receiver.bodyOf("/otlp/v1/traces").includes("/api/health")).toBe(false);
    expect(receiver.bodyOf("/otlp/v1/metrics").includes("http.server.request.duration")).toBe(false);
  });

  it("records no server span with instrumentations.http false", async () => {
    receiver = await startOtlpReceiver();
    const appUrl = await startApp();
    const handle = startObservability({
      serviceName: "my-service",
      endpoint: `${receiver.url}${OTLP_PATH}`,
      instrumentations: { fetch: false, http: false },
    });

    await get(`${appUrl}/orders`);
    await handle.forceFlush();

    expect(receiver.bodyOf("/otlp/v1/traces").includes("/orders")).toBe(false);
    expect(receiver.bodyOf("/otlp/v1/metrics").includes("http.server.request.duration")).toBe(false);
  });
});

describe("startObservability: metrics", () => {
  it("exports the HTTP server duration and Node.js runtime metrics with the auth header", async () => {
    receiver = await startOtlpReceiver();
    const appUrl = await startApp();
    const handle = startObservability({
      serviceName: "my-service",
      environment: "prod",
      endpoint: `${receiver.url}/otlp`,
      headers: { Authorization: AUTHORIZATION },
    });

    await get(`${appUrl}/orders`);
    await handle.forceFlush();

    const requests = receiver.requests.filter((request) => request.path === "/otlp/v1/metrics");
    expect(requests.length).toBeGreaterThan(0);
    for (const request of requests) {
      expect(request.method).toBe("POST");
      expect(request.headers["content-type"]).toBe("application/x-protobuf");
      expect(request.headers.authorization).toBe(AUTHORIZATION);
    }
    const metrics = receiver.bodyOf("/otlp/v1/metrics");
    expect(metrics.includes("http.server.request.duration")).toBe(true);
    expect(metrics.includes("nodejs.eventloop.utilization")).toBe(true);
    expect(metrics.includes("my-service")).toBe(true);
    expect(metrics.includes("deployment.environment")).toBe(true);
  });

  it("exports the last runtime metrics on shutdown, without a flush before it", async () => {
    receiver = await startOtlpReceiver();
    const handle = startObservability({ serviceName: "my-service", endpoint: receiver.url });

    await handle.shutdown();

    expect(receiver.bodyOf("/v1/metrics").includes("nodejs.eventloop.utilization")).toBe(true);
  });

  it("exports no runtime metrics with instrumentations.runtime false", async () => {
    receiver = await startOtlpReceiver();
    const handle = startObservability({
      serviceName: "my-service",
      endpoint: receiver.url,
      instrumentations: { runtime: false },
    });

    await handle.forceFlush();

    expect(receiver.bodyOf("/v1/metrics").includes("nodejs.eventloop")).toBe(false);
  });

  it("exports no metrics with metrics.enabled false and says so at start", async () => {
    receiver = await startOtlpReceiver();
    const appUrl = await startApp();
    const handle = startObservability({
      serviceName: "my-service",
      endpoint: receiver.url,
      metrics: { enabled: false },
    });

    await get(`${appUrl}/orders`);
    await handle.forceFlush();

    expect(receiver.requests.some((request) => request.path === "/v1/metrics")).toBe(false);
    expect(receiver.requests.some((request) => request.path === "/v1/traces")).toBe(true);
    expect(output).toContain(`observability: exporting traces and logs to ${receiver.url} as my-service`);
  });
});

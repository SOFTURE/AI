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
  vi.restoreAllMocks();
});

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
    await fetch(`${receiver.url}/ping`);
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

    expect(output.some((line) => line.startsWith("observability: exporting"))).toBe(true);
    expect(output.join("\n")).not.toContain("c2VjcmV0");
    expect(output.join("\n")).not.toContain("secret");
  });

  it("returns the first handle on a second call in the same process", async () => {
    receiver = await startOtlpReceiver();
    const first = startObservability({ serviceName: "my-service", endpoint: receiver.url });

    const second = startObservability({ serviceName: "other", endpoint: receiver.url });

    expect(second).toBe(first);
    expect(output.filter((line) => line.includes("already started"))).toHaveLength(1);
  });

  it("keeps logging without throwing after shutdown", async () => {
    receiver = await startOtlpReceiver();
    const handle = startObservability({ serviceName: "my-service", endpoint: receiver.url });

    await handle.shutdown();

    expect(() => createLogger("orders").info("after shutdown")).not.toThrow();
    expect(output).toContain("info orders: after shutdown");
  });
});

import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { logs } from "@opentelemetry/api-logs";
import { InMemoryLogRecordExporter, LoggerProvider, SimpleLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createLogger } from "../src/index.js";
import { createOnRequestError, isClientAbortError, registerObservability } from "../src/next/index.js";
import { resetObservabilityForTests } from "../src/node/start.js";
import { startOtlpReceiver, type OtlpReceiver } from "./otlp-receiver.js";

const initialRuntime = process.env.NEXT_RUNTIME;
let output: string[];
let receiver: OtlpReceiver | undefined;
let app: Server | undefined;

beforeEach(() => {
  output = [];
  for (const method of ["log", "error", "warn"] as const) {
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
  Reflect.deleteProperty(globalThis, "EdgeRuntime");
  if (initialRuntime === undefined) {
    delete process.env.NEXT_RUNTIME;
  } else {
    process.env.NEXT_RUNTIME = initialRuntime;
  }
});

describe("registerObservability", () => {
  it("starts nothing in the edge runtime", async () => {
    process.env.NEXT_RUNTIME = "edge";

    const handle = await registerObservability({ serviceName: "my-service" });

    expect(handle).toBeNull();
    expect(output).toEqual([]);
  });

  it("starts nothing where the EdgeRuntime global is defined, even with NEXT_RUNTIME unset", async () => {
    delete process.env.NEXT_RUNTIME;
    Object.defineProperty(globalThis, "EdgeRuntime", { value: "edge-runtime", configurable: true });

    const handle = await registerObservability({ serviceName: "my-service" });

    expect(handle).toBeNull();
    expect(output).toEqual([]);
  });

  it("starts observability under a standalone server, where NEXT_RUNTIME is unset", async () => {
    delete process.env.NEXT_RUNTIME;

    const handle = await registerObservability({ serviceName: "my-service" });

    expect(handle?.isExporting).toBe(false);
    expect(output).toContain("observability: export disabled (no OTLP endpoint)");
  });

  it("starts observability in the Node.js runtime", async () => {
    process.env.NEXT_RUNTIME = "nodejs";

    const handle = await registerObservability({ serviceName: "my-service" });

    expect(handle?.isExporting).toBe(false);
    expect(output).toContain("observability: export disabled (no OTLP endpoint)");
  });
});

describe("registerObservability: defaults", () => {
  it("adds no HTTP server span of its own, since Next.js spans its requests, and still exports metrics", async () => {
    process.env.NEXT_RUNTIME = "nodejs";
    receiver = await startOtlpReceiver();
    app = createServer((_request, response) => response.end("ok"));
    await new Promise<void>((resolve) => app?.listen(0, "127.0.0.1", resolve));
    const { port } = app.address() as AddressInfo;

    const handle = await registerObservability({ serviceName: "my-service", endpoint: receiver.url });
    const response = await fetch(`http://127.0.0.1:${String(port)}/orders`);
    await response.arrayBuffer();
    await handle?.forceFlush();

    expect(receiver.bodyOf("/v1/traces").includes("/orders")).toBe(false);
    expect(receiver.bodyOf("/v1/metrics").includes("nodejs.eventloop.utilization")).toBe(true);
  });
});

describe("createOnRequestError", () => {
  describe("a client's aborted request (#1071)", () => {
    const request = { path: "/orders?token=secret-token", method: "POST", headers: {} };
    const context = {
      routerKind: "App Router",
      routePath: "/orders",
      routeType: "action",
      renderSource: "react-server-components-payload",
    };

    function captureRecords() {
      const exporter = new InMemoryLogRecordExporter();
      logs.setGlobalLoggerProvider(new LoggerProvider({ processors: [new SimpleLogRecordProcessor({ exporter })] }));
      return exporter;
    }

    const abortShapes: [string, unknown][] = [
      ["React's closed destination stream", Object.assign(new Error("The destination stream closed early."), { digest: "4120385542" })],
      ["Node's premature close", Object.assign(new Error("Premature close"), { code: "ERR_STREAM_PREMATURE_CLOSE" })],
      ["Next's ResponseAborted", Object.assign(new Error("Response aborted"), { name: "ResponseAborted" })],
      ["Node's aborted request", Object.assign(new Error("aborted"), { code: "ECONNRESET" })],
    ];

    it.each(abortShapes)("logs %s as one info record with the request fields and no exception", (_label, error) => {
      const exporter = captureRecords();

      createOnRequestError(createLogger("next"))(error, request, context);

      const records = exporter.getFinishedLogRecords();
      expect(records).toHaveLength(1);
      expect(records[0]?.severityText).toBe("INFO");
      expect(records[0]?.body).toBe("request aborted by the client");
      expect(records[0]?.attributes).toMatchObject({
        outcome: "client_aborted",
        "http.request.method": "POST",
        "url.path": "/orders",
        "next.route": "/orders",
        "next.route_type": "action",
        "next.router_kind": "App Router",
        "next.render_source": "react-server-components-payload",
      });
      expect(Object.keys(records[0]?.attributes ?? {}).filter((key) => key.startsWith("exception."))).toEqual([]);
      expect(output.join("\n")).not.toContain("secret-token");
    });

    it("keeps the digest on the abort record, so it groups with the error page", () => {
      const exporter = captureRecords();

      createOnRequestError(createLogger("next"))(abortShapes[0]?.[1], request, context);

      expect(exporter.getFinishedLogRecords()[0]?.attributes["next.digest"]).toBe("4120385542");
    });

    it("keeps an error that only mentions the phrase or shares the digest as an error with its stack", () => {
      const exporter = captureRecords();
      const onRequestError = createOnRequestError(createLogger("next"));

      onRequestError(new Error("Upload failed: The destination stream closed early."), request, context);
      onRequestError(Object.assign(new Error("render failed"), { digest: "4120385542" }), request, context);
      onRequestError(Object.assign(new Error("connect failed"), { code: "ECONNRESET" }), request, context);

      const records = exporter.getFinishedLogRecords();
      expect(records.map((record) => [record.severityText, record.body])).toEqual([
        ["ERROR", "request failed"],
        ["ERROR", "request failed"],
        ["ERROR", "request failed"],
      ]);
      expect(records[1]?.attributes["exception.stacktrace"]).toContain("render failed");
    });

    it("recognises only error-like objects", () => {
      expect(isClientAbortError(undefined)).toBe(false);
      expect(isClientAbortError("The destination stream closed early.")).toBe(false);
      expect(isClientAbortError({ message: "The destination stream closed early." })).toBe(true);
    });

    it("lets an app extend the recognition with its own predicate", () => {
      const exporter = captureRecords();
      const onRequestError = createOnRequestError(createLogger("next"), {
        isClientAbort: (error) => isClientAbortError(error) || (error instanceof Error && error.name === "AbortError"),
      });

      onRequestError(Object.assign(new Error("This operation was aborted"), { name: "AbortError" }), request, context);
      onRequestError(new Error("The destination stream closed early."), request, context);

      expect(exporter.getFinishedLogRecords().map((record) => record.severityText)).toEqual(["INFO", "INFO"]);
    });

    it("logs every abort as an error when the app turns the recognition off", () => {
      const exporter = captureRecords();
      const onRequestError = createOnRequestError(createLogger("next"), { isClientAbort: () => false });

      onRequestError(new Error("The destination stream closed early."), request, context);

      const [record] = exporter.getFinishedLogRecords();
      expect(record?.severityText).toBe("ERROR");
      expect(record?.body).toBe("request failed");
    });
  });

  it("logs one error record with the route attributes and no headers", () => {
    const exporter = new InMemoryLogRecordExporter();
    logs.setGlobalLoggerProvider(new LoggerProvider({ processors: [new SimpleLogRecordProcessor({ exporter })] }));
    const onRequestError = createOnRequestError(createLogger("next"));

    onRequestError(
      new Error("render failed"),
      { path: "/orders/7", method: "GET", headers: { cookie: "session=secret-cookie" } },
      { routerKind: "App Router", routePath: "/orders/[id]", routeType: "render" },
    );

    const records = exporter.getFinishedLogRecords();
    expect(records).toHaveLength(1);
    expect(records[0]?.attributes).toMatchObject({
      "http.request.method": "GET",
      "url.path": "/orders/7",
      "next.route": "/orders/[id]",
      "next.route_type": "render",
      "exception.message": "render failed",
    });
    expect(JSON.stringify(records[0]?.attributes)).not.toContain("secret-cookie");
    expect(output.join("\n")).not.toContain("secret-cookie");
  });

  it("logs Next's hashed digest and the render source, so the line matches the error page", () => {
    const exporter = new InMemoryLogRecordExporter();
    logs.setGlobalLoggerProvider(new LoggerProvider({ processors: [new SimpleLogRecordProcessor({ exporter })] }));
    const onRequestError = createOnRequestError(createLogger("next"));
    const context = {
      routerKind: "App Router",
      routePath: "/orders",
      routeType: "render",
      renderSource: "react-server-components-payload",
    };

    onRequestError(Object.assign(new Error("a"), { digest: "2915047134" }), { path: "/orders", method: "GET", headers: {} }, context);
    onRequestError(Object.assign(new Error("b"), { digest: "123@E394" }), { path: "/orders", method: "GET", headers: {} }, context);

    const [first, second] = exporter.getFinishedLogRecords();
    expect(first?.attributes["next.digest"]).toBe("2915047134");
    expect(first?.attributes["next.render_source"]).toBe("react-server-components-payload");
    expect(second?.attributes["next.digest"]).toBe("123@E394");
  });

  it("never logs a NEXT_ digest, which can carry a URL", () => {
    const exporter = new InMemoryLogRecordExporter();
    logs.setGlobalLoggerProvider(new LoggerProvider({ processors: [new SimpleLogRecordProcessor({ exporter })] }));
    const onRequestError = createOnRequestError(createLogger("next"));

    onRequestError(
      Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/reset?token=secret-token;307;" }),
      { path: "/orders", method: "GET", headers: {} },
      { routerKind: "App Router", routePath: "/orders", routeType: "render" },
    );

    const [record] = exporter.getFinishedLogRecords();
    expect(record?.attributes).not.toHaveProperty("next.digest");
    expect(record?.attributes).not.toHaveProperty("next.render_source");
    expect(output.join("\n")).not.toContain("secret-token");
  });

  it("logs the path without its query string, which can carry tokens", () => {
    const exporter = new InMemoryLogRecordExporter();
    logs.setGlobalLoggerProvider(new LoggerProvider({ processors: [new SimpleLogRecordProcessor({ exporter })] }));
    const onRequestError = createOnRequestError(createLogger("next"));

    onRequestError(
      new Error("reset failed"),
      { path: "/password/reset?token=secret-reset-token&next=%2F", method: "POST", headers: {} },
      { routerKind: "App Router", routePath: "/password/reset", routeType: "action" },
    );

    const [record] = exporter.getFinishedLogRecords();
    expect(record?.attributes["url.path"]).toBe("/password/reset");
    expect(JSON.stringify(record?.attributes)).not.toContain("secret-reset-token");
    expect(output.join("\n")).not.toContain("secret-reset-token");
  });
});

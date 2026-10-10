import { logs } from "@opentelemetry/api-logs";
import { InMemoryLogRecordExporter, LoggerProvider, SimpleLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createLogger } from "../src/index.js";
import { createOnRequestError, registerObservability } from "../src/next/index.js";
import { resetObservabilityForTests } from "../src/node/start.js";

const initialRuntime = process.env.NEXT_RUNTIME;
let output: string[];

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
  vi.restoreAllMocks();
  if (initialRuntime === undefined) {
    delete process.env.NEXT_RUNTIME;
  } else {
    process.env.NEXT_RUNTIME = initialRuntime;
  }
});

describe("registerObservability", () => {
  it("starts nothing outside the Node.js runtime", async () => {
    process.env.NEXT_RUNTIME = "edge";

    const handle = await registerObservability({ serviceName: "my-service" });

    expect(handle).toBeNull();
    expect(output).toEqual([]);
  });

  it("starts observability in the Node.js runtime", async () => {
    process.env.NEXT_RUNTIME = "nodejs";

    const handle = await registerObservability({ serviceName: "my-service" });

    expect(handle?.isExporting).toBe(false);
    expect(output).toContain("observability: export disabled (no OTLP endpoint)");
  });
});

describe("createOnRequestError", () => {
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

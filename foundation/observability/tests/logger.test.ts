import { context, trace } from "@opentelemetry/api";
import { logs, SeverityNumber } from "@opentelemetry/api-logs";
import {
  InMemoryLogRecordExporter,
  LoggerProvider,
  SimpleLogRecordProcessor,
} from "@opentelemetry/sdk-logs";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { configureLogging, createLogger, parseLogLevel } from "../src/index.js";
import { resetLoggingForTests } from "../src/logger.js";

type ConsoleCalls = { log: string[]; error: string[] };

function captureConsole(): ConsoleCalls {
  const calls: ConsoleCalls = { log: [], error: [] };
  vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
    calls.log.push(args.map(String).join(" "));
  });
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    calls.error.push(args.map(String).join(" "));
  });
  return calls;
}

function installLogExporter(): InMemoryLogRecordExporter {
  const exporter = new InMemoryLogRecordExporter();
  logs.setGlobalLoggerProvider(
    new LoggerProvider({ processors: [new SimpleLogRecordProcessor({ exporter })] }),
  );
  return exporter;
}

let calls: ConsoleCalls;

beforeEach(() => {
  delete process.env.SOFTURE_LOG_LEVEL;
  calls = captureConsole();
});

afterEach(() => {
  vi.restoreAllMocks();
  resetLoggingForTests();
  logs.disable();
  trace.disable();
  context.disable();
  delete process.env.SOFTURE_LOG_LEVEL;
});

describe("parseLogLevel", () => {
  it("accepts level names in any case", () => {
    expect(parseLogLevel("DEBUG")).toBe("debug");
    expect(parseLogLevel("warn")).toBe("warn");
  });

  it("returns null for anything else", () => {
    expect(parseLogLevel("verbose")).toBeNull();
    expect(parseLogLevel(undefined)).toBeNull();
    expect(parseLogLevel("")).toBeNull();
  });
});

describe("level filtering", () => {
  it("drops debug at the default info level", () => {
    createLogger("orders").debug("hidden");

    expect(calls.log).toEqual([]);
  });

  it("lets debug through when SOFTURE_LOG_LEVEL=debug", () => {
    process.env.SOFTURE_LOG_LEVEL = "debug";

    createLogger("orders").debug("shown");

    expect(calls.log).toEqual(["debug orders: shown"]);
  });

  it("falls back to info when SOFTURE_LOG_LEVEL is not a level", () => {
    process.env.SOFTURE_LOG_LEVEL = "loud";
    const logger = createLogger("orders");

    logger.debug("hidden");
    logger.info("shown");

    expect(calls.log).toEqual(["info orders: shown"]);
  });

  it("prefers the logger option over configureLogging and the environment", () => {
    process.env.SOFTURE_LOG_LEVEL = "debug";
    configureLogging({ level: "error" });

    createLogger("orders", { level: "warn" }).info("hidden");
    createLogger("orders", { level: "warn" }).warn("shown");
    createLogger("other").warn("hidden by configureLogging");

    expect(calls.log).toEqual([]);
    expect(calls.error).toEqual(["warn orders: shown"]);
  });
});

describe("console output", () => {
  it("writes debug and info to console.log, warn and error to console.error", () => {
    configureLogging({ level: "debug" });
    const logger = createLogger("orders");

    logger.debug("a");
    logger.info("b");
    logger.warn("c");
    logger.error("d");

    expect(calls.log).toEqual(["debug orders: a", "info orders: b"]);
    expect(calls.error).toEqual(["warn orders: c", "error orders: d"]);
  });

  it("appends attributes as key=value, quoting values with spaces", () => {
    createLogger("orders").info("saved", {
      orderId: 42,
      note: "two words",
      paid: true,
      skipped: undefined,
      at: new Date("2026-10-10T08:00:00Z"),
      tags: ["a", "b"],
      meta: { source: "api" },
    });

    expect(calls.log).toEqual([
      'info orders: saved orderId=42 note="two words" paid=true at=2026-10-10T08:00:00.000Z tags=a,b meta="{\\"source\\":\\"api\\"}"',
    ]);
  });

  it("escapes line breaks in the message, so a message cannot forge a console line", () => {
    createLogger("orders").info("first\nerror orders: forged\r");

    expect(calls.log).toEqual(["info orders: first\\nerror orders: forged\\r"]);
  });

  it("merges child attributes over the parent's", () => {
    const logger = createLogger("orders").child({ tenant: "a", region: "eu" }).child({ tenant: "b" });

    logger.info("saved", { orderId: 1 });

    expect(calls.log).toEqual(["info orders: saved tenant=b region=eu orderId=1"]);
  });
});

describe("errors", () => {
  it("records type, message and stack in full mode", () => {
    const exporter = installLogExporter();
    const error = new TypeError("bad input for user@example.com");

    createLogger("orders").error("save failed", { error });

    expect(calls.error[0]).toBe("error orders: save failed error=TypeError: bad input for user@example.com");
    expect(calls.error[1]).toContain("TypeError: bad input");
    const [record] = exporter.getFinishedLogRecords();
    expect(record?.attributes["exception.type"]).toBe("TypeError");
    expect(record?.attributes["exception.message"]).toBe("bad input for user@example.com");
    expect(record?.attributes["exception.stacktrace"]).toEqual(expect.stringContaining("TypeError: bad input"));
  });

  it("records only the error label and no stack in label mode", () => {
    const exporter = installLogExporter();
    configureLogging({ errorDetails: "label" });

    createLogger("orders").error("save failed", { error: new TypeError("bad input for user@example.com") });

    expect(calls.error).toEqual(["error orders: save failed error=TypeError"]);
    const [record] = exporter.getFinishedLogRecords();
    expect(record?.attributes["exception.type"]).toBe("TypeError");
    expect(record?.attributes["exception.message"]).toBe("TypeError");
    expect(record?.attributes["exception.stacktrace"]).toBeUndefined();
  });

  it("describes a thrown value that is not an Error by its type", () => {
    const exporter = installLogExporter();

    createLogger("orders").error("save failed", { error: "plain string" });

    expect(calls.error).toEqual(["error orders: save failed error=string"]);
    expect(exporter.getFinishedLogRecords()[0]?.attributes["exception.type"]).toBe("string");
  });
});

describe("OpenTelemetry log records", () => {
  it("emits severity, body, scope and attributes", () => {
    const exporter = installLogExporter();

    createLogger("orders").child({ tenant: "a" }).warn("slow", { ms: 1200 });

    const [record] = exporter.getFinishedLogRecords();
    expect(record?.severityNumber).toBe(SeverityNumber.WARN);
    expect(record?.severityText).toBe("WARN");
    expect(record?.body).toBe("slow");
    expect(record?.instrumentationScope.name).toBe("orders");
    expect(record?.attributes).toEqual({ tenant: "a", ms: 1200 });
  });

  it("carries the trace and span ids of the active span", () => {
    const exporter = installLogExporter();
    const tracerProvider = new NodeTracerProvider();
    tracerProvider.register();

    let spanContext: { traceId: string; spanId: string } | undefined;
    trace.getTracer("test").startActiveSpan("work", (span) => {
      spanContext = span.spanContext();
      createLogger("orders").info("inside");
      span.end();
    });

    const [record] = exporter.getFinishedLogRecords();
    expect(record?.spanContext?.traceId).toBe(spanContext?.traceId);
    expect(record?.spanContext?.spanId).toBe(spanContext?.spanId);
  });

  it("still writes to the console when no logger provider is registered", () => {
    expect(() => createLogger("orders").info("console only")).not.toThrow();

    expect(calls.log).toEqual(["info orders: console only"]);
  });
});

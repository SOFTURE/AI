import { context, logs, SeverityNumber, trace } from "@opentelemetry/api";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import {
  InMemoryLogRecordExporter,
  LoggerProvider,
  SimpleLogRecordProcessor,
} from "@opentelemetry/sdk-logs";
import { TracerProvider } from "@opentelemetry/sdk-trace";
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

  it("records the error label and the top app frames, never the message, in label mode", () => {
    const exporter = installLogExporter();
    configureLogging({ errorDetails: "label" });

    const createInputError = (): TypeError => new TypeError("bad input for user@example.com");

    createLogger("orders").error("save failed", { error: createInputError() });

    expect(calls.error[0]).toBe("error orders: save failed error=TypeError");
    expect(calls.error.join("\n")).not.toContain("user@example.com");
    const [record] = exporter.getFinishedLogRecords();
    expect(record?.attributes["exception.type"]).toBe("TypeError");
    expect(record?.attributes["exception.message"]).toBe("TypeError");
    const stacktrace = record?.attributes["exception.stacktrace"];
    expect(typeof stacktrace).toBe("string");
    const frames = (stacktrace as string).split("\n");
    expect(frames).toHaveLength(2);
    expect(frames[0]).toMatch(/^at createInputError \(.*logger\.test\.ts:\d+:\d+\)$/);
    expect(frames[1]).toMatch(/logger\.test\.ts:\d+:\d+\)?$/);
    expect(JSON.stringify(record?.attributes)).not.toContain("user@example.com");
  });

  it("logs a database error's frame location and nothing of its query in label mode", () => {
    const exporter = installLogExporter();
    configureLogging({ errorDetails: "label" });
    const error = new Error('Failed query: select * from "users" where email = $1\nparams: secret@x.pl');

    createLogger("next").error("request failed", { error });

    const [record] = exporter.getFinishedLogRecords();
    expect(record?.attributes["exception.message"]).toBe("Error");
    expect(record?.attributes["exception.stacktrace"]).toEqual(expect.stringMatching(/^at .*logger\.test\.ts:\d+/));
    expect(JSON.stringify(record?.attributes)).not.toMatch(/secret@x\.pl|Failed query|select/);
    expect(calls.error.join("\n")).not.toMatch(/secret@x\.pl|Failed query/);
  });

  it("names the kinds and safe codes of the cause chain in label mode", () => {
    const exporter = installLogExporter();
    configureLogging({ errorDetails: "label" });
    const error = new Error("timeout", { cause: Object.assign(new Error("x"), { code: "ETIMEDOUT" }) });

    createLogger("next").error("request failed", { error });

    expect(calls.error[0]).toBe("error next: request failed error=Error cause=Error code=ETIMEDOUT");
    expect(exporter.getFinishedLogRecords()[0]?.attributes["exception.message"]).toBe("Error cause=Error code=ETIMEDOUT");
  });

  it("keeps a code of the error itself and a SQLSTATE deeper in the chain, and drops free-text codes", () => {
    const exporter = installLogExporter();
    configureLogging({ errorDetails: "label" });
    const driverError = Object.assign(new Error("terminating connection"), { name: "DatabaseError", code: "57P01" });
    const wrapped = new Error("Failed query", { cause: Object.assign(new Error("y"), { code: "user@x.pl", cause: driverError }) });
    const error = Object.assign(new TypeError("fetch failed", { cause: wrapped }), { code: "UND_ERR_CONNECT_TIMEOUT" });

    createLogger("db").error("query failed", { error });

    expect(exporter.getFinishedLogRecords()[0]?.attributes["exception.message"]).toBe(
      "TypeError code=UND_ERR_CONNECT_TIMEOUT cause=Error cause=Error cause=DatabaseError code=57P01",
    );
  });

  it("describes a cause that is not an Error by its type and stops after three causes", () => {
    const exporter = installLogExporter();
    configureLogging({ errorDetails: "label" });
    const loop = new Error("a");
    loop.cause = loop;
    const plain = new Error("b", { cause: "secret text" });

    createLogger("x").error("one", { error: loop });
    createLogger("x").error("two", { error: plain });

    const [first, second] = exporter.getFinishedLogRecords();
    expect(first?.attributes["exception.message"]).toBe("Error cause=Error cause=Error cause=Error");
    expect(second?.attributes["exception.message"]).toBe("Error cause=string");
  });

  it("records no frames when the message changed after the stack was taken", () => {
    const exporter = installLogExporter();
    configureLogging({ errorDetails: "label" });
    const error = new Error("first");
    expect(error.stack).toContain("first"); // V8 formats the stack on first read; a later message is not in it.
    error.message = "second";

    createLogger("x").error("failed", { error });

    expect(exporter.getFinishedLogRecords()[0]?.attributes["exception.stacktrace"]).toBeUndefined();
  });

  it("logs a string error by its text in full mode, never by its bare type", () => {
    const exporter = installLogExporter();

    createLogger("speech").warn("isolation refused", { error: "voice isolation answered 400: audio too short" });

    expect(calls.error).toEqual(["warn speech: isolation refused error=voice isolation answered 400: audio too short"]);
    const [record] = exporter.getFinishedLogRecords();
    expect(record?.attributes["exception.type"]).toBe("string");
    expect(record?.attributes["exception.message"]).toBe("voice isolation answered 400: audio too short");
    expect(record?.attributes["exception.stacktrace"]).toBeUndefined();
  });

  it("describes other non-Error values by their value or JSON in full mode", () => {
    const exporter = installLogExporter();
    class ProviderFailure {
      readonly status = 429;
    }

    const logger = createLogger("x");
    logger.error("number", { error: 42 });
    logger.error("null", { error: null });
    logger.error("undefined", { error: undefined });
    logger.error("object", { error: { code: "quota_exceeded", status: 429 } });
    logger.error("instance", { error: new ProviderFailure() });

    const records = exporter.getFinishedLogRecords().map((record) => [
      record.attributes["exception.type"],
      record.attributes["exception.message"],
    ]);
    expect(records).toEqual([
      ["number", "42"],
      ["null", "null"],
      ["undefined", "undefined"],
      ["object", '{"code":"quota_exceeded","status":429}'],
      ["ProviderFailure", '{"status":429}'],
    ]);
  });

  it("caps a long non-Error description and falls back to its kind when it cannot be serialized", () => {
    const exporter = installLogExporter();
    const circular: Record<string, unknown> = { code: "ECONNRESET" };
    circular.self = circular;

    createLogger("x").error("long", { error: "a".repeat(1500) });
    createLogger("x").error("circular", { error: circular });
    createLogger("x").error("bigint", { error: { amount: 10n } });

    const [long, loop, bigint] = exporter.getFinishedLogRecords();
    expect(long?.attributes["exception.message"]).toBe(`${"a".repeat(999)}…`);
    expect(loop?.attributes["exception.message"]).toBe("object code=ECONNRESET");
    expect(bigint?.attributes["exception.message"]).toBe("object");
  });

  it("marks a non-Error value as withheld in label mode and never logs its text", () => {
    const exporter = installLogExporter();
    configureLogging({ errorDetails: "label" });

    createLogger("speech").warn("isolation refused", { error: "refused for user@example.com" });
    createLogger("db").error("connect failed", { error: { code: "ECONNREFUSED", detail: "host secret.internal" } });

    expect(calls.error[0]).toBe("warn speech: isolation refused error=non-Error string (text withheld in label mode)");
    const [text, object] = exporter.getFinishedLogRecords();
    expect(text?.attributes["exception.type"]).toBe("string");
    expect(text?.attributes["exception.message"]).toBe("non-Error string (text withheld in label mode)");
    expect(object?.attributes["exception.type"]).toBe("object");
    expect(object?.attributes["exception.message"]).toBe("non-Error object code=ECONNREFUSED (value withheld in label mode)");
    const logged = JSON.stringify([text?.attributes, object?.attributes, calls]);
    expect(logged).not.toMatch(/user@example\.com|secret\.internal/);
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
    context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
    trace.setGlobalTracerProvider(new TracerProvider());

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

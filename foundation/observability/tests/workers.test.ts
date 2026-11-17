import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createLogger } from "../src/index.js";
import { encodeLogs, toUnixNano } from "../src/workers/otlp-json.js";
import { withObservability, withScheduledObservability, type WorkersExecutionContext } from "../src/workers/index.js";

type Sent = { url: string; headers: Record<string, string>; body: unknown };

const ENDPOINT_ENV = {
  OTEL_EXPORTER_OTLP_ENDPOINT: "https://otlp.example.test/otlp",
  OTEL_EXPORTER_OTLP_HEADERS: "Authorization=Basic%20abc",
};
const appLogger = createLogger("shop.checkout");

function createContext(): { ctx: WorkersExecutionContext; settle: () => Promise<unknown[]>; count: () => number } {
  const pending: Promise<unknown>[] = [];
  return {
    ctx: { waitUntil: (promise) => pending.push(promise) },
    settle: () => Promise.all(pending),
    count: () => pending.length,
  };
}

function createFetch(respond: () => Promise<Response> = () => Promise.resolve(new Response("{}"))): { fetch: typeof fetch; sent: Sent[] } {
  const sent: Sent[] = [];
  const fake = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const body = typeof init?.body === "string" ? init.body : "null";
    sent.push({ url, headers: init?.headers as Record<string, string>, body: JSON.parse(body) as unknown });
    return respond();
  }) as typeof fetch;
  return { fetch: fake, sent };
}

type LogsBody = { resourceLogs: { resource: { attributes: { key: string; value: unknown }[] }; scopeLogs: { scope: { name: string }; logRecords: Record<string, unknown>[] }[] }[] };
type TracesBody = { resourceSpans: { scopeSpans: { spans: Record<string, unknown>[] }[] }[] };

function readRecords(sent: readonly Sent[]): Record<string, unknown>[] {
  const body = sent.find((item) => item.url.endsWith("/v1/logs"))?.body as LogsBody | undefined;
  return body?.resourceLogs.flatMap((resource) => resource.scopeLogs.flatMap((scope) => scope.logRecords)) ?? [];
}

function readSpans(sent: readonly Sent[]): Record<string, unknown>[] {
  const body = sent.find((item) => item.url.endsWith("/v1/traces"))?.body as TracesBody | undefined;
  return body?.resourceSpans.flatMap((resource) => resource.scopeSpans.flatMap((scope) => scope.spans)) ?? [];
}

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("withObservability on Workers", () => {
  it("sends nothing and waits for nothing without an OTLP endpoint", async () => {
    const { fetch, sent } = createFetch();
    const { ctx, count } = createContext();
    const handler = withObservability(() => new Response("ok"), { fetch });
    const response = await handler(new Request("https://shop.example.test/"), {}, ctx);
    expect(await response.text()).toBe("ok");
    expect(count()).toBe(0);
    expect(sent).toEqual([]);
  });

  it("sends the request's log records and its server span with the same trace", async () => {
    const { fetch, sent } = createFetch();
    const { ctx, settle } = createContext();
    const handler = withObservability(
      () => {
        appLogger.info("order placed", { "order.items": 3 });
        return new Response("created", { status: 201 });
      },
      { fetch, serviceNamespace: "shop", serviceName: "shop", environment: "production" },
    );
    await handler(new Request("https://shop.example.test/orders?id=7", { method: "POST" }), ENDPOINT_ENV, ctx);
    await settle();

    expect(sent.map((item) => item.url).sort()).toEqual(["https://otlp.example.test/otlp/v1/logs", "https://otlp.example.test/otlp/v1/traces"]);
    expect(sent[0]?.headers).toEqual({ Authorization: "Basic abc", "content-type": "application/json" });
    const [span] = readSpans(sent);
    expect(span).toMatchObject({
      name: "POST",
      kind: 2,
      status: { code: 0 },
      attributes: [
        { key: "http.request.method", value: { stringValue: "POST" } },
        { key: "url.path", value: { stringValue: "/orders" } },
        { key: "url.scheme", value: { stringValue: "https" } },
        { key: "server.address", value: { stringValue: "shop.example.test" } },
        { key: "http.response.status_code", value: { intValue: "201" } },
      ],
    });
    expect(span?.traceId).toMatch(/^[0-9a-f]{32}$/);
    expect(span?.spanId).toMatch(/^[0-9a-f]{16}$/);
    const [record] = readRecords(sent);
    expect(record).toMatchObject({
      severityNumber: 9,
      severityText: "INFO",
      body: { stringValue: "order placed" },
      attributes: [{ key: "order.items", value: { intValue: "3" } }],
      traceId: span?.traceId,
      spanId: span?.spanId,
    });
    const resource = (sent[0]?.body as LogsBody).resourceLogs[0]?.resource.attributes;
    expect(resource).toEqual(
      expect.arrayContaining([
        { key: "service.name", value: { stringValue: "shop" } },
        { key: "service.namespace", value: { stringValue: "shop" } },
        { key: "deployment.environment.name", value: { stringValue: "production" } },
      ]),
    );
  });

  it("continues the caller's trace from a traceparent header", async () => {
    const { fetch, sent } = createFetch();
    const { ctx, settle } = createContext();
    const handler = withObservability(() => new Response("ok"), { fetch });
    const headers = { traceparent: "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01" };
    await handler(new Request("https://shop.example.test/", { headers }), ENDPOINT_ENV, ctx);
    await settle();
    expect(readSpans(sent)[0]).toMatchObject({ traceId: "0af7651916cd43dd8448eb211c80319c", parentSpanId: "b7ad6b7169203331" });
  });

  it("marks a thrown error on the span, logs it and throws it on", async () => {
    const { fetch, sent } = createFetch();
    const { ctx, settle } = createContext();
    const failure = new TypeError("cart is gone");
    const handler = withObservability(() => Promise.reject(failure), { fetch });
    await expect(handler(new Request("https://shop.example.test/cart"), ENDPOINT_ENV, ctx)).rejects.toBe(failure);
    await settle();
    const [span] = readSpans(sent);
    expect(span?.status).toEqual({ code: 2 });
    expect(span?.attributes).toContainEqual({ key: "error.type", value: { stringValue: "TypeError" } });
    expect(readRecords(sent).map((record) => record.body)).toEqual([{ stringValue: "request failed" }]);
  });

  it("marks a 5xx response as an error and leaves a 4xx unset", async () => {
    const { fetch, sent } = createFetch();
    const { ctx, settle } = createContext();
    const handler = withObservability((request) => new Response("", { status: request.url.endsWith("/down") ? 503 : 404 }), { fetch });
    await handler(new Request("https://shop.example.test/down"), ENDPOINT_ENV, ctx);
    await handler(new Request("https://shop.example.test/missing"), ENDPOINT_ENV, ctx);
    await settle();
    const spans = sent.filter((item) => item.url.endsWith("/v1/traces")).flatMap((item) => readSpans([item]));
    expect(spans.map((span) => span.status)).toEqual([{ code: 2 }, { code: 0 }]);
    expect(spans[0]?.attributes).toContainEqual({ key: "error.type", value: { stringValue: "503" } });
  });

  it("gives an ignored path no span but still sends its records", async () => {
    const { fetch, sent } = createFetch();
    const { ctx, settle } = createContext();
    const handler = withObservability(
      () => {
        appLogger.warn("health probe slow");
        return new Response("ok");
      },
      { fetch, ignorePaths: ["/api/health"] },
    );
    await handler(new Request("https://shop.example.test/api/health/db"), ENDPOINT_ENV, ctx);
    await settle();
    expect(sent.map((item) => item.url)).toEqual(["https://otlp.example.test/otlp/v1/logs"]);
  });

  it("matches an ignored path written with trailing slashes and refuses one without a leading slash", async () => {
    const { fetch, sent } = createFetch();
    const { ctx, settle } = createContext();
    const handler = withObservability(() => new Response("ok"), { fetch, ignorePaths: ["/api/health///"] });
    await handler(new Request("https://shop.example.test/api/health"), ENDPOINT_ENV, ctx);
    await handler(new Request("https://shop.example.test/api/healthz"), ENDPOINT_ENV, ctx);
    await settle();
    expect(readSpans(sent).map((span) => span.attributes)).toContainEqual(expect.arrayContaining([{ key: "url.path", value: { stringValue: "/api/healthz" } }]));
    expect(readSpans(sent)).toHaveLength(1);
    expect(() => withObservability(() => new Response("ok"), { ignorePaths: ["api/health"] })).toThrow(
      "observability: traces.ignorePaths[0] must be a path starting with /",
    );
  });

  it("keeps the response when the export fails and names no URL or header in the report", async () => {
    const { fetch } = createFetch(() => Promise.reject(new TypeError("network down")));
    const { ctx, settle } = createContext();
    const handler = withObservability(() => new Response("ok"), { fetch });
    const response = await handler(new Request("https://shop.example.test/"), ENDPOINT_ENV, ctx);
    await settle();
    expect(response.status).toBe(200);
    const reports = vi.mocked(console.error).mock.calls.map((call) => String(call[0]));
    expect(reports).toEqual(["observability: the OTLP traces export failed (TypeError)"]);
  });

  it("sends a record written outside a request with the next request", async () => {
    const { fetch, sent } = createFetch();
    const { ctx, settle } = createContext();
    const handler = withObservability(() => new Response("ok"), { fetch });
    appLogger.info("isolate started");
    await handler(new Request("https://shop.example.test/"), ENDPOINT_ENV, ctx);
    await settle();
    const [record] = readRecords(sent);
    expect(record?.body).toEqual({ stringValue: "isolate started" });
    expect(record?.traceId).toBeUndefined();
  });
});

describe("withScheduledObservability on Workers", () => {
  const controller = { scheduledTime: Date.UTC(2026, 10, 17, 12, 0), cron: "* * * * *" };

  it("sends nothing and waits for nothing without an OTLP endpoint, and returns the handler's result", async () => {
    const { fetch, sent } = createFetch();
    const { ctx, count } = createContext();
    const handler = withScheduledObservability(() => Promise.resolve({ ran: 2 }), { fetch });
    await expect(handler(controller, {}, ctx)).resolves.toEqual({ ran: 2 });
    expect(count()).toBe(0);
    expect(sent).toEqual([]);
  });

  it("sends the run's log records and one internal span named scheduled with the cron", async () => {
    const { fetch, sent } = createFetch();
    const { ctx, settle } = createContext();
    const handler = withScheduledObservability(
      async () => {
        await Promise.resolve();
        appLogger.info("tick ran", { "jobs.ran": 4 });
      },
      { fetch, serviceNamespace: "shop", serviceName: "shop-jobs", environment: "production" },
    );
    await handler(controller, ENDPOINT_ENV, ctx);
    await settle();
    const [span] = readSpans(sent);
    expect(span).toMatchObject({
      name: "scheduled",
      kind: 1,
      status: { code: 0 },
      attributes: [
        { key: "faas.trigger", value: { stringValue: "timer" } },
        { key: "faas.cron", value: { stringValue: "* * * * *" } },
      ],
    });
    const [record] = readRecords(sent);
    expect(record).toMatchObject({ body: { stringValue: "tick ran" }, traceId: span?.traceId, spanId: span?.spanId });
    const resource = (sent.find((item) => item.url.endsWith("/v1/logs"))?.body as LogsBody).resourceLogs[0]?.resource.attributes;
    expect(resource).toContainEqual({ key: "service.name", value: { stringValue: "shop-jobs" } });
  });

  it("marks a thrown error on the span, logs it and throws it on", async () => {
    const { fetch, sent } = createFetch();
    const { ctx, settle } = createContext();
    const failure = new RangeError("no database");
    const handler = withScheduledObservability(() => Promise.reject(failure), { fetch });
    await expect(handler(controller, ENDPOINT_ENV, ctx)).rejects.toBe(failure);
    await settle();
    const [span] = readSpans(sent);
    expect(span?.status).toEqual({ code: 2 });
    expect(span?.attributes).toContainEqual({ key: "error.type", value: { stringValue: "RangeError" } });
    expect(readRecords(sent).map((record) => record.body)).toEqual([{ stringValue: "scheduled run failed" }]);
  });
});

describe("the OTLP JSON encoding", () => {
  it("writes integers as strings, other numbers as doubles and arrays element by element", () => {
    const body = JSON.parse(
      encodeLogs({ "service.name": "shop" }, [
        { scope: "a", timeUnixNano: "1", severityNumber: 9, severityText: "INFO", body: "x", attributes: { count: 2, ratio: 0.5, tags: ["a", "b"], ok: true } },
      ]),
    ) as LogsBody;
    expect(body.resourceLogs[0]?.scopeLogs[0]?.logRecords[0]?.attributes).toEqual([
      { key: "count", value: { intValue: "2" } },
      { key: "ratio", value: { doubleValue: 0.5 } },
      { key: "tags", value: { arrayValue: { values: [{ stringValue: "a" }, { stringValue: "b" }] } } },
      { key: "ok", value: { boolValue: true } },
    ]);
  });

  it("turns epoch milliseconds into nanoseconds without losing precision", () => {
    expect(toUnixNano(1_763_300_000_123)).toBe("1763300000123000000");
    expect(toUnixNano(0)).toBe("0");
  });
});

import { trace } from "@opentelemetry/api";
import { BasicTracerProvider } from "@opentelemetry/sdk-trace-node";
import { afterEach, describe, expect, it, vi } from "vitest";

import { probeObservability } from "../src/node/index.js";
import { resetObservabilityForTests } from "../src/node/start.js";
import { startOtlpReceiver, type OtlpReceiver } from "./otlp-receiver.js";

const AUTHORIZATION = "Basic c2VjcmV0LWluc3RhbmNlOnNlY3JldC10b2tlbg==";

let receiver: OtlpReceiver | undefined;

afterEach(async () => {
  await resetObservabilityForTests();
  await receiver?.close();
  receiver = undefined;
  vi.restoreAllMocks();
});

describe("probeObservability", () => {
  it("sends one probe span and one probe log record and reports both accepted", async () => {
    receiver = await startOtlpReceiver();

    const result = await probeObservability(
      { serviceName: "my-service", endpoint: `${receiver.url}/otlp`, headers: { Authorization: AUTHORIZATION } },
      {},
    );

    expect(result).toEqual({
      kind: "checked",
      isAccepted: true,
      signals: [
        { signal: "traces", outcome: "accepted", target: `${receiver.url}/otlp/v1/traces` },
        { signal: "logs", outcome: "accepted", target: `${receiver.url}/otlp/v1/logs` },
      ],
    });
    expect(receiver.requests.map((request) => request.path).sort()).toEqual(["/otlp/v1/logs", "/otlp/v1/traces"]);
    for (const request of receiver.requests) {
      expect(request.headers.authorization).toBe(AUTHORIZATION);
      expect(request.body.includes("softure.probe")).toBe(true);
      expect(request.body.includes("my-service")).toBe(true);
    }
  });

  it.each([401, 404])("reports a %i as refused with the status", async (status) => {
    receiver = await startOtlpReceiver({ status });

    const result = await probeObservability({ endpoint: receiver.url }, {});

    expect(result.kind === "checked" && result.isAccepted).toBe(false);
    const signals = result.kind === "checked" ? result.signals : [];
    expect(signals.map((signal) => [signal.signal, signal.outcome, "status" in signal ? signal.status : null])).toEqual([
      ["traces", "refused", status],
      ["logs", "refused", status],
    ]);
  });

  it("reports an unreachable endpoint as refused without a status", async () => {
    receiver = await startOtlpReceiver();
    const url = receiver.url;
    await receiver.close();
    receiver = undefined;

    const result = await probeObservability({ endpoint: url, timeoutMs: 2_000 }, {});

    const signals = result.kind === "checked" ? result.signals : [];
    expect(signals.map((signal) => (signal.outcome === "refused" ? signal.status : signal.outcome))).toEqual([
      null,
      null,
    ]);
  });

  it("probes only the signal that has an endpoint", async () => {
    receiver = await startOtlpReceiver();

    const result = await probeObservability({}, { OTEL_EXPORTER_OTLP_LOGS_ENDPOINT: `${receiver.url}/v1/logs` });

    expect(result).toEqual({
      kind: "checked",
      isAccepted: true,
      signals: [
        { signal: "traces", outcome: "not configured" },
        { signal: "logs", outcome: "accepted", target: `${receiver.url}/v1/logs` },
      ],
    });
  });

  it("says export is disabled without an endpoint", async () => {
    expect(await probeObservability({}, {})).toEqual({ kind: "disabled", reason: "no OTLP endpoint" });
  });

  it("leaves the global tracer provider alone", async () => {
    receiver = await startOtlpReceiver();

    await probeObservability({ endpoint: receiver.url }, {});

    expect(trace.setGlobalTracerProvider(new BasicTracerProvider())).toBe(true);
  });

  it("never shows credentials of the endpoint URL in the target", async () => {
    receiver = await startOtlpReceiver();
    const withCredentials = receiver.url.replace("http://", "http://user:secret@");

    const result = await probeObservability({ endpoint: `${withCredentials}/?token=secret` }, {});

    expect(JSON.stringify(result)).not.toContain("secret");
  });
});

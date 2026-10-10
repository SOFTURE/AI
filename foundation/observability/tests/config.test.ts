import { describe, expect, it } from "vitest";

import { resolveObservabilityConfig } from "../src/node/index.js";

const BASE = "https://otlp.example.com/otlp";

describe("resolveObservabilityConfig: endpoints", () => {
  it("is disabled without any endpoint", () => {
    expect(resolveObservabilityConfig({ serviceName: "svc" }, {})).toEqual({
      kind: "disabled",
      reason: "no OTLP endpoint",
    });
  });

  it("is disabled by OTEL_SDK_DISABLED even with an endpoint", () => {
    const config = resolveObservabilityConfig({ endpoint: BASE }, { OTEL_SDK_DISABLED: "true" });

    expect(config).toEqual({ kind: "disabled", reason: "OTEL_SDK_DISABLED" });
  });

  it("is disabled by enabled: false", () => {
    const config = resolveObservabilityConfig({ endpoint: BASE, enabled: false }, {});

    expect(config).toEqual({ kind: "disabled", reason: "enabled: false" });
  });

  it("appends the signal paths to a base endpoint, with or without a trailing slash", () => {
    for (const endpoint of [BASE, `${BASE}/`]) {
      const config = resolveObservabilityConfig({ endpoint }, {});

      expect(config).toMatchObject({
        kind: "export",
        traces: { url: `${BASE}/v1/traces` },
        logs: { url: `${BASE}/v1/logs` },
      });
    }
  });

  it("prefers the option endpoint over the environment", () => {
    const config = resolveObservabilityConfig(
      { endpoint: BASE },
      {
        OTEL_EXPORTER_OTLP_ENDPOINT: "https://env.example.com",
        OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: "https://traces.example.com/custom",
      },
    );

    expect(config).toMatchObject({ traces: { url: `${BASE}/v1/traces` }, logs: { url: `${BASE}/v1/logs` } });
  });

  it("uses a per-signal environment endpoint as given and the base one for the other signal", () => {
    const config = resolveObservabilityConfig(
      {},
      {
        OTEL_EXPORTER_OTLP_ENDPOINT: "https://env.example.com/otlp",
        OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: "https://traces.example.com/custom",
      },
    );

    expect(config).toMatchObject({
      kind: "export",
      traces: { url: "https://traces.example.com/custom" },
      logs: { url: "https://env.example.com/otlp/v1/logs" },
    });
  });

  it("exports only the signal that has an endpoint", () => {
    const config = resolveObservabilityConfig({}, { OTEL_EXPORTER_OTLP_LOGS_ENDPOINT: "https://logs.example.com/l" });

    expect(config).toMatchObject({ kind: "export", traces: null, logs: { url: "https://logs.example.com/l" } });
  });

  it("refuses an endpoint that is not an http(s) URL, naming the source and not the value", () => {
    expect(() => resolveObservabilityConfig({}, { OTEL_EXPORTER_OTLP_ENDPOINT: "ftp://secret-host" })).toThrow(
      /OTEL_EXPORTER_OTLP_ENDPOINT/,
    );
    expect(() => resolveObservabilityConfig({}, { OTEL_EXPORTER_OTLP_ENDPOINT: "ftp://secret-host" })).not.toThrow(
      /secret-host/,
    );
    expect(() => resolveObservabilityConfig({ endpoint: "not a url" }, {})).toThrow(/options\.endpoint/);
  });
});

describe("resolveObservabilityConfig: headers", () => {
  it("parses OTEL_EXPORTER_OTLP_HEADERS, keeping '=' inside values and decoding them", () => {
    const config = resolveObservabilityConfig(
      { endpoint: BASE },
      { OTEL_EXPORTER_OTLP_HEADERS: "Authorization=Basic%20dXNlcjpwYXNz==, x-tenant = a" },
    );

    expect(config).toMatchObject({
      traces: { headers: { Authorization: "Basic dXNlcjpwYXNz==", "x-tenant": "a" } },
      logs: { headers: { Authorization: "Basic dXNlcjpwYXNz==", "x-tenant": "a" } },
    });
  });

  it("prefers option headers and lets per-signal environment headers add to them", () => {
    const config = resolveObservabilityConfig(
      { endpoint: BASE, headers: { Authorization: "Basic option" } },
      { OTEL_EXPORTER_OTLP_HEADERS: "Authorization=Basic env", OTEL_EXPORTER_OTLP_LOGS_HEADERS: "x-logs=1" },
    );

    expect(config).toMatchObject({
      traces: { headers: { Authorization: "Basic option" } },
      logs: { headers: { Authorization: "Basic option", "x-logs": "1" } },
    });
  });

  it("refuses a header entry without a key, naming the source and not the value", () => {
    const resolve = () =>
      resolveObservabilityConfig({ endpoint: BASE }, { OTEL_EXPORTER_OTLP_HEADERS: "=Basic secret-token" });

    expect(resolve).toThrow(/OTEL_EXPORTER_OTLP_HEADERS/);
    expect(resolve).not.toThrow(/secret-token/);
  });
});

describe("resolveObservabilityConfig: resource", () => {
  it("overlays OTEL_RESOURCE_ATTRIBUTES, then OTEL_SERVICE_NAME, then the options", () => {
    const config = resolveObservabilityConfig(
      { endpoint: BASE, serviceNamespace: "my-project", environment: "production" },
      {
        OTEL_RESOURCE_ATTRIBUTES: "service.name=from-attributes,service.version=1.0.0,team=a%20b",
        OTEL_SERVICE_NAME: "from-env",
      },
    );

    expect(config).toMatchObject({
      resourceAttributes: {
        "service.name": "from-env",
        "service.version": "1.0.0",
        "service.namespace": "my-project",
        "deployment.environment.name": "production",
        team: "a b",
      },
    });
  });

  it("lets the options win over every environment value", () => {
    const config = resolveObservabilityConfig(
      { endpoint: BASE, serviceName: "my-service", serviceVersion: "2.0.0" },
      { OTEL_SERVICE_NAME: "from-env", OTEL_RESOURCE_ATTRIBUTES: "service.version=1.0.0" },
    );

    expect(config).toMatchObject({
      resourceAttributes: { "service.name": "my-service", "service.version": "2.0.0" },
    });
  });
});

import { describe, expect, it } from "vitest";

import { resolveObservabilityConfig } from "../src/node/index.js";

const BASE = "https://otlp.example.com/otlp";

describe("resolveObservabilityConfig: endpoints", () => {
  it("is disabled without any endpoint", () => {
    expect(resolveObservabilityConfig({ serviceName: "svc" }, {})).toEqual({
      kind: "disabled",
      reason: "no OTLP endpoint",
      warnings: [],
    });
  });

  it("is disabled by OTEL_SDK_DISABLED even with an endpoint", () => {
    const config = resolveObservabilityConfig({ endpoint: BASE }, { OTEL_SDK_DISABLED: "true" });

    expect(config).toEqual({ kind: "disabled", reason: "OTEL_SDK_DISABLED", warnings: [] });
  });

  it("is disabled by enabled: false", () => {
    const config = resolveObservabilityConfig({ endpoint: BASE, enabled: false }, {});

    expect(config).toEqual({ kind: "disabled", reason: "enabled: false", warnings: [] });
  });

  it("appends the signal paths to a base endpoint, with or without a trailing slash", () => {
    for (const endpoint of [BASE, `${BASE}/`]) {
      const config = resolveObservabilityConfig({ endpoint }, {});

      expect(config).toMatchObject({
        kind: "export",
        traces: { url: `${BASE}/v1/traces` },
        logs: { url: `${BASE}/v1/logs` },
        metrics: { url: `${BASE}/v1/metrics` },
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

  it("uses OTEL_EXPORTER_OTLP_METRICS_ENDPOINT as given, with its own headers over the shared ones", () => {
    const config = resolveObservabilityConfig(
      {},
      {
        OTEL_EXPORTER_OTLP_ENDPOINT: BASE,
        OTEL_EXPORTER_OTLP_HEADERS: "authorization=shared,x-a=1",
        OTEL_EXPORTER_OTLP_METRICS_ENDPOINT: "https://metrics.example.com/m",
        OTEL_EXPORTER_OTLP_METRICS_HEADERS: "authorization=metrics",
      },
    );

    expect(config).toMatchObject({
      kind: "export",
      logs: { url: `${BASE}/v1/logs`, headers: { authorization: "shared", "x-a": "1" } },
      metrics: { url: "https://metrics.example.com/m", headers: { authorization: "metrics", "x-a": "1" } },
    });
  });

  it("exports no metrics with metrics.enabled false, keeping traces and logs", () => {
    const config = resolveObservabilityConfig({ endpoint: BASE, metrics: { enabled: false } }, {});

    expect(config).toMatchObject({
      kind: "export",
      traces: { url: `${BASE}/v1/traces` },
      logs: { url: `${BASE}/v1/logs` },
      metrics: null,
    });
  });

  it("exports no metrics with OTEL_METRICS_EXPORTER=none, in any case", () => {
    for (const value of ["none", "NONE", " none "]) {
      const config = resolveObservabilityConfig({ endpoint: BASE }, { OTEL_METRICS_EXPORTER: value });

      expect(config).toMatchObject({ kind: "export", traces: { url: `${BASE}/v1/traces` }, metrics: null });
    }
  });

  it("exports no metrics for a short-lived process, keeping traces and logs, also with a metrics endpoint", () => {
    const env = { OTEL_EXPORTER_OTLP_METRICS_ENDPOINT: "https://metrics.example.com/m" };

    const config = resolveObservabilityConfig({ endpoint: BASE, lifetime: "short" }, env);

    expect(config).toMatchObject({
      kind: "export",
      traces: { url: `${BASE}/v1/traces` },
      logs: { url: `${BASE}/v1/logs` },
      metrics: null,
    });
  });

  it("exports metrics for a long-lived process, the default", () => {
    for (const lifetime of ["long", undefined] as const) {
      const config = resolveObservabilityConfig({ endpoint: BASE, lifetime }, {});

      expect(config).toMatchObject({ kind: "export", metrics: { url: `${BASE}/v1/metrics` } });
    }
  });

  it("exports only the signal that has an endpoint", () => {
    const config = resolveObservabilityConfig({}, { OTEL_EXPORTER_OTLP_LOGS_ENDPOINT: "https://logs.example.com/l" });

    expect(config).toMatchObject({
      kind: "export",
      traces: null,
      logs: { url: "https://logs.example.com/l" },
      metrics: null,
    });
  });

  it("keeps the host of a base endpoint whose path starts with two slashes", () => {
    const config = resolveObservabilityConfig({ endpoint: "https://otlp.example.com//otlp" }, {});

    expect(config.kind).toBe("export");
    const urls = config.kind === "export" ? [config.traces?.url, config.logs?.url] : [];
    expect(urls).toHaveLength(2);
    for (const url of urls) {
      expect(new URL(url ?? "").host).toBe("otlp.example.com");
    }
  });

  it("keeps the query string and the credentials of a base endpoint", () => {
    const config = resolveObservabilityConfig({ endpoint: "https://user:pass@otlp.example.com/otlp?tenant=a" }, {});

    expect(config).toMatchObject({
      traces: { url: "https://user:pass@otlp.example.com/otlp/v1/traces?tenant=a" },
      logs: { url: "https://user:pass@otlp.example.com/otlp/v1/logs?tenant=a" },
    });
  });

  it("refuses an endpoint that is not a URL, naming the source and not the value", () => {
    expect(() => resolveObservabilityConfig({}, { OTEL_EXPORTER_OTLP_ENDPOINT: "secret-host:4318" })).toThrow(
      /OTEL_EXPORTER_OTLP_ENDPOINT is not a URL/,
    );
    expect(() => resolveObservabilityConfig({}, { OTEL_EXPORTER_OTLP_ENDPOINT: "secret host" })).not.toThrow(
      /secret/,
    );
    expect(() => resolveObservabilityConfig({ endpoint: "not a url" }, {})).toThrow(/options\.endpoint/);
  });

  it("disables export for BuildKit's unix:// trace socket, warning with the variable and the scheme only", () => {
    const config = resolveObservabilityConfig(
      {},
      { OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: "unix:///dev/otel-grpc.sock" },
    );

    const warning = "OTEL_EXPORTER_OTLP_TRACES_ENDPOINT has the unsupported scheme unix: (only http: and https:)";
    expect(config).toEqual({ kind: "disabled", reason: warning, warnings: [warning] });
  });

  it("keeps exporting the other signal when one endpoint has an unsupported scheme", () => {
    const config = resolveObservabilityConfig(
      {},
      { OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: "unix:///dev/otel-grpc.sock", OTEL_EXPORTER_OTLP_ENDPOINT: BASE },
    );

    expect(config).toMatchObject({
      kind: "export",
      traces: null,
      logs: { url: `${BASE}/v1/logs` },
      warnings: ["OTEL_EXPORTER_OTLP_TRACES_ENDPOINT has the unsupported scheme unix: (only http: and https:)"],
    });
  });

  it("disables export for an unsupported scheme in options.endpoint, without the value in the warning", () => {
    const config = resolveObservabilityConfig({ endpoint: "grpc://secret-host:4317" }, {});

    const warning = "options.endpoint has the unsupported scheme grpc: (only http: and https:)";
    expect(config).toEqual({ kind: "disabled", reason: warning, warnings: [warning] });
    expect(JSON.stringify(config)).not.toContain("secret-host");
  });
});

describe("resolveObservabilityConfig: headers", () => {
  it("parses OTEL_EXPORTER_OTLP_HEADERS, keeping '=' inside values and decoding them", () => {
    const config = resolveObservabilityConfig(
      { endpoint: BASE },
      { OTEL_EXPORTER_OTLP_HEADERS: "Authorization=Basic%20dXNlcjpwYXNz==, x-tenant = a" },
    );

    expect(config.kind === "export" && config.traces?.headers).toEqual({
      Authorization: "Basic dXNlcjpwYXNz==",
      "x-tenant": "a",
    });
    expect(config.kind === "export" && config.logs?.headers).toEqual({
      Authorization: "Basic dXNlcjpwYXNz==",
      "x-tenant": "a",
    });
  });

  it("merges headers per key: per-signal environment over shared environment, options over both", () => {
    const config = resolveObservabilityConfig(
      { endpoint: BASE, headers: { Authorization: "Basic option" } },
      {
        OTEL_EXPORTER_OTLP_HEADERS: "Authorization=Basic env,x-shared=1",
        OTEL_EXPORTER_OTLP_LOGS_HEADERS: "Authorization=Basic logs-env,x-logs=1",
      },
    );

    expect(config.kind === "export" && config.traces?.headers).toEqual({
      Authorization: "Basic option",
      "x-shared": "1",
    });
    expect(config.kind === "export" && config.logs?.headers).toEqual({
      Authorization: "Basic option",
      "x-shared": "1",
      "x-logs": "1",
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
        "deployment.environment": "production",
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

  it("writes the environment option under both deployment.environment keys, over OTEL_RESOURCE_ATTRIBUTES", () => {
    const config = resolveObservabilityConfig(
      { endpoint: BASE, environment: "prod" },
      { OTEL_RESOURCE_ATTRIBUTES: "deployment.environment=staging,deployment.environment.name=staging" },
    );

    expect(config).toMatchObject({
      resourceAttributes: { "deployment.environment": "prod", "deployment.environment.name": "prod" },
    });
  });

  it("leaves both deployment.environment keys from OTEL_RESOURCE_ATTRIBUTES alone without the option", () => {
    const config = resolveObservabilityConfig(
      { endpoint: BASE },
      { OTEL_RESOURCE_ATTRIBUTES: "deployment.environment=staging" },
    );

    expect(config.kind === "export" ? config.resourceAttributes : null).toEqual({
      "deployment.environment": "staging",
    });
  });
});

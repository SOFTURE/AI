import { describe, expect, it } from "vitest";

import { createExportRequestMatcher, type OutgoingRequestTarget } from "../src/node/export-request-matcher.js";

const isExportRequest = createExportRequestMatcher([
  "https://otlp.example.com/otlp/v1/traces",
  "https://otlp.example.com/otlp/v1/metrics",
  "http://[::1]:4318/v1/logs",
]);

// The shape the http instrumentation passes for a `URL` argument: no port when the URL has the default one.
function https(path: string, extra: OutgoingRequestTarget = {}): OutgoingRequestTarget {
  return { protocol: "https:", hostname: "otlp.example.com", path, ...extra };
}

describe("createExportRequestMatcher", () => {
  it("matches a request to an export URL", () => {
    expect(isExportRequest(https("/otlp/v1/traces"))).toBe(true);
    expect(isExportRequest(https("/otlp/v1/metrics"))).toBe(true);
  });

  it("fills in the scheme's default port and ignores the host's case", () => {
    expect(isExportRequest(https("/otlp/v1/traces", { port: 443 }))).toBe(true);
    expect(isExportRequest(https("/otlp/v1/traces", { port: "443" }))).toBe(true);
    expect(isExportRequest(https("/otlp/v1/traces", { hostname: "OTLP.example.com" }))).toBe(true);
  });

  it("matches an IPv6 host with or without brackets", () => {
    expect(isExportRequest({ protocol: "http:", hostname: "::1", port: 4318, path: "/v1/logs" })).toBe(true);
    expect(isExportRequest({ protocol: "http:", hostname: "[::1]", port: 4318, path: "/v1/logs" })).toBe(true);
  });

  it("does not match another path, query, port or scheme on the same host", () => {
    expect(isExportRequest(https("/otlp/v1/logs"))).toBe(false);
    expect(isExportRequest(https("/health"))).toBe(false);
    expect(isExportRequest(https("/otlp/v1/traces?x=1"))).toBe(false);
    expect(isExportRequest(https("/otlp/v1/traces", { port: 8443 }))).toBe(false);
    expect(isExportRequest(https("/otlp/v1/traces", { protocol: "http:" }))).toBe(false);
  });

  it("matches nothing without export URLs", () => {
    expect(createExportRequestMatcher([])({ protocol: "http:", hostname: "localhost", path: "/" })).toBe(false);
  });
});

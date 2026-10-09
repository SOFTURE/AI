import { describe, expect, it } from "vitest";
import { formatVerifyReport } from "./report.js";
import type { RouteReport } from "./run-checks.js";

const passing = (method: RouteReport["method"], path: string, status: number): RouteReport => ({
  method,
  path,
  url: `https://example.com${path}`,
  status,
  checks: [{ kind: "status", passed: true, detail: `status ${status}` }],
  passed: true,
  severity: "fail",
});

describe("formatVerifyReport", () => {
  it("names the method of a route that is not GET, so two routes on one path stay apart", () => {
    const text = formatVerifyReport(
      { routes: [passing("GET", "/api/mcp", 405), passing("POST", "/api/mcp", 401)], tls: null, origin: null },
      "https://example.com",
    );
    expect(text.split("\n").slice(0, 3)).toEqual([
      "Result  Status  Route          Detail",
      "PASS    405     /api/mcp       1 check passed",
      "PASS    401     POST /api/mcp  1 check passed",
    ]);
  });

  it("prints the origin row after the tls row and names both in the summary", () => {
    const text = formatVerifyReport(
      {
        routes: [passing("GET", "/", 200)],
        tls: { passed: true, daysLeft: 41, detail: "41 days left (until 2026-11-16), issuer Let's Encrypt" },
        origin: { address: "203.0.113.7:443", passed: false, severity: "fail", detail: "203.0.113.7:443 accepted a direct connection; the firewall lets more than the CDN through" },
      },
      "https://example.com",
    );
    expect(text).toBe(
      [
        "Result  Status  Route   Detail",
        "PASS    200     /       1 check passed",
        "PASS    -       tls     41 days left (until 2026-11-16), issuer Let's Encrypt",
        "FAIL    -       origin  203.0.113.7:443 accepted a direct connection; the firewall lets more than the CDN through",
        "",
        "verify: 1 routes at https://example.com, 1 passed, 0 failed; certificate passed; origin failed",
        "",
      ].join("\n"),
    );
  });

  it("prints WARN for a failed warn row and counts it apart from the failures", () => {
    const warned: RouteReport = {
      ...passing("GET", "/blog/x", 404),
      checks: [{ kind: "status", passed: false, detail: "status 404, expected 200" }],
      passed: false,
      severity: "warn",
    };
    const text = formatVerifyReport(
      {
        routes: [passing("GET", "/", 200), warned],
        tls: null,
        origin: { address: "203.0.113.7:443", passed: false, severity: "warn", detail: "203.0.113.7:443 accepted a direct connection" },
      },
      "https://example.com",
    );
    expect(text).toBe(
      [
        "Result  Status  Route    Detail",
        "PASS    200     /        1 check passed",
        "WARN    404     /blog/x  status 404, expected 200",
        "WARN    -       origin   203.0.113.7:443 accepted a direct connection",
        "",
        "verify: 2 routes at https://example.com, 1 passed, 0 failed, 1 warned; origin warned",
        "",
      ].join("\n"),
    );
  });
});

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
});

describe("formatVerifyReport", () => {
  it("names the method of a route that is not GET, so two routes on one path stay apart", () => {
    const text = formatVerifyReport(
      { routes: [passing("GET", "/api/mcp", 405), passing("POST", "/api/mcp", 401)], tls: null },
      "https://example.com",
    );
    expect(text.split("\n").slice(0, 3)).toEqual([
      "Result  Status  Route          Detail",
      "PASS    405     /api/mcp       1 check passed",
      "PASS    401     POST /api/mcp  1 check passed",
    ]);
  });
});

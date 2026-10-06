import { describe, expect, it } from "vitest";
import { checkResponse, joinUrl, mergeHeaderChecks, type ObservedResponse } from "./checks.js";
import type { VerifyRoute } from "./schema.js";

const BASE = "https://example.com";

function route(overrides: Partial<VerifyRoute> = {}): VerifyRoute {
  return { path: "/", status: 200, contains: [], excludes: [], headers: {}, method: "GET", requestHeaders: {}, ...overrides };
}

function response(overrides: Partial<Omit<ObservedResponse, "getHeader">> & { headers?: Record<string, string> } = {}): ObservedResponse {
  const headers = overrides.headers ?? {};
  return {
    requestUrl: overrides.requestUrl ?? `${BASE}/`,
    status: overrides.status ?? 200,
    body: overrides.body ?? null,
    getHeader: (name) => headers[name] ?? null,
  };
}

describe("checkResponse", () => {
  it("passes a matching status and names it", () => {
    expect(checkResponse({ route: route(), headers: {}, response: response(), baseUrl: BASE })).toEqual([
      { kind: "status", passed: true, detail: "status 200" },
    ]);
  });

  it("fails another status with expected and actual", () => {
    expect(checkResponse({ route: route(), headers: {}, response: response({ status: 502 }), baseUrl: BASE })).toEqual([
      { kind: "status", passed: false, detail: "status 502, expected 200" },
    ]);
  });

  it("checks markers that must be present and absent", () => {
    const checks = checkResponse({
      route: route({ contains: ["<h1>Pricing", "Buy"], excludes: ["Application error", "Pricing"] }),
      headers: {},
      response: response({ body: "<h1>Pricing</h1>" }),
      baseUrl: BASE,
    });
    expect(checks.slice(1)).toEqual([
      { kind: "contains", passed: true, detail: 'contains "<h1>Pricing"' },
      { kind: "contains", passed: false, detail: 'missing "Buy"' },
      { kind: "excludes", passed: true, detail: 'no "Application error"' },
      { kind: "excludes", passed: false, detail: 'unexpected "Pricing"' },
    ]);
  });

  it("matches a redirect given as a path, a relative location and an absolute URL", () => {
    const relative = response({ status: 301, headers: { location: "/pl/" } });
    const absolute = response({ status: 301, headers: { location: "https://example.com/pl/" } });
    for (const observed of [relative, absolute]) {
      expect(checkResponse({ route: route({ status: 301, redirect: "/pl/" }), headers: {}, response: observed, baseUrl: BASE })[1]).toEqual({
        kind: "redirect",
        passed: true,
        detail: "redirect to https://example.com/pl/",
      });
    }
    const external = checkResponse({
      route: route({ status: 302, redirect: "https://login.example.org/" }),
      headers: {},
      response: response({ status: 302, headers: { location: "https://login.example.org/" } }),
      baseUrl: BASE,
    });
    expect(external[1]?.passed).toBe(true);
  });

  it("fails a redirect elsewhere or without a location header", () => {
    const wrong = checkResponse({
      route: route({ status: 308, redirect: "/new" }),
      headers: {},
      response: response({ status: 308, headers: { location: "/old" } }),
      baseUrl: BASE,
    });
    expect(wrong[1]).toEqual({ kind: "redirect", passed: false, detail: "redirect to https://example.com/old, expected https://example.com/new" });
    const none = checkResponse({ route: route({ status: 308, redirect: "/new" }), headers: {}, response: response({ status: 308 }), baseUrl: BASE });
    expect(none[1]).toEqual({ kind: "redirect", passed: false, detail: "no location header, expected https://example.com/new" });
  });

  it("resolves a redirect path under a base URL with a path prefix", () => {
    const checks = checkResponse({
      route: route({ path: "/old", status: 301, redirect: "/new" }),
      headers: {},
      response: response({ requestUrl: "https://example.com/app/old", status: 301, headers: { location: "/app/new" } }),
      baseUrl: "https://example.com/app",
    });
    expect(checks[1]).toEqual({ kind: "redirect", passed: true, detail: "redirect to https://example.com/app/new" });
  });

  it("checks header values case-insensitively and headers that must be absent", () => {
    const checks = checkResponse({
      route: route(),
      headers: { "content-type": "TEXT/HTML", "x-powered-by": null, "strict-transport-security": "max-age", server: null },
      response: response({ headers: { "content-type": "text/html; charset=utf-8", server: "nginx" } }),
      baseUrl: BASE,
    });
    expect(checks.slice(1)).toEqual([
      { kind: "header", passed: true, detail: 'content-type has "TEXT/HTML"' },
      { kind: "header", passed: true, detail: "no x-powered-by" },
      { kind: "header", passed: false, detail: 'missing strict-transport-security, expected "max-age"' },
      { kind: "header", passed: false, detail: 'unexpected server: "nginx"' },
    ]);
  });

  it("fails a header with another value", () => {
    const checks = checkResponse({
      route: route(),
      headers: { "x-frame-options": "DENY" },
      response: response({ headers: { "x-frame-options": "SAMEORIGIN" } }),
      baseUrl: BASE,
    });
    expect(checks[1]).toEqual({ kind: "header", passed: false, detail: 'x-frame-options: "SAMEORIGIN", expected "DENY"' });
  });
});

describe("mergeHeaderChecks", () => {
  it("lets a route's entry replace the global one for the same name", () => {
    expect(mergeHeaderChecks({ "x-robots-tag": null, "x-frame-options": "DENY" }, { "x-robots-tag": "noindex" })).toEqual({
      "x-robots-tag": "noindex",
      "x-frame-options": "DENY",
    });
  });
});

describe("joinUrl", () => {
  it("keeps the base path and drops a trailing slash of the base", () => {
    expect(joinUrl("https://example.com/", "/a?b=1")).toBe("https://example.com/a?b=1");
    expect(joinUrl("https://example.com/app", "/")).toBe("https://example.com/app/");
    expect(joinUrl(`https://example.com${"/".repeat(50_000)}`, "/a")).toBe("https://example.com/a");
  });
});

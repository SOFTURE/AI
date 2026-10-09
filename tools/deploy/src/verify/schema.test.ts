import { describe, expect, it } from "vitest";
import { parseDeployConfig } from "./schema.js";

describe("parseDeployConfig", () => {
  it("fills the defaults of a minimal verify section", () => {
    expect(parseDeployConfig({ verify: { routes: [{ path: "/" }] } })).toEqual({
      ok: true,
      config: {
        verify: {
          timeoutMs: 10_000,
          headers: {},
          originSeverity: "fail",
          routes: [{ path: "/", status: 200, contains: [], excludes: [], headers: {}, method: "GET", requestHeaders: {}, severity: "fail" }],
        },
      },
    });
  });

  it("accepts a file without a verify section and with a $schema key", () => {
    expect(parseDeployConfig({ $schema: "https://example.com/s.json" })).toEqual({
      ok: true,
      config: { $schema: "https://example.com/s.json" },
    });
  });

  it("keeps a redirect, markers, header checks and null for an absent header", () => {
    const route = {
      path: "/old?x=1",
      status: 308,
      redirect: "/new",
      contains: ["a"],
      excludes: ["b"],
      headers: { "x-powered-by": null, "content-type": "text/html" },
    };
    const parsed = parseDeployConfig({ verify: { timeoutMs: 500, routes: [route] } });
    expect(parsed.ok && parsed.config.verify?.routes[0]).toEqual({ ...route, method: "GET", requestHeaders: {}, severity: "fail" });
  });

  it("keeps a header list and refuses an empty list or an empty item", () => {
    const parsed = parseDeployConfig({ verify: { headers: { vary: ["accept", "accept-encoding"] }, routes: [{ path: "/" }] } });
    expect(parsed.ok && parsed.config.verify?.headers).toEqual({ vary: ["accept", "accept-encoding"] });
    expect(parseDeployConfig({ verify: { routes: [{ path: "/", headers: { link: [] } }] } })).toEqual({
      ok: false,
      issues: ["verify.routes.0.headers.link: Too small: expected array to have >=1 items"],
    });
    expect(parseDeployConfig({ verify: { routes: [{ path: "/", headers: { link: [""] } }] } })).toEqual({
      ok: false,
      issues: ["verify.routes.0.headers.link.0: Too small: expected string to have >=1 characters"],
    });
  });

  it("keeps a method, a body and request headers", () => {
    const route = {
      path: "/api/mcp",
      status: 401,
      method: "POST",
      body: '{"jsonrpc":"2.0","id":1,"method":"tools/list"}',
      requestHeaders: { "content-type": "application/json", "user-agent": "GPTBot/1.3" },
    };
    const parsed = parseDeployConfig({ verify: { routes: [route] } });
    expect(parsed.ok && parsed.config.verify?.routes[0]).toEqual({ ...route, contains: [], excludes: [], headers: {}, severity: "fail" });
  });

  it.each([
    ["a path without a leading slash", { path: "login" }, "verify.routes.0.path: a path that starts with a single /"],
    ["a protocol-relative path", { path: "//evil.example" }, "verify.routes.0.path: a path that starts with a single /"],
    ["a path with a space", { path: "/a b" }, "verify.routes.0.path: a path that starts with a single /"],
    ["a redirect without a 3xx status", { path: "/", redirect: "/x" }, "verify.routes.0.status: a redirect needs a 3xx status"],
    ["an empty marker", { path: "/", contains: [""] }, "verify.routes.0.contains.0: Too small: expected string to have >=1 characters"],
    ["a status out of range", { path: "/", status: 99 }, "verify.routes.0.status: Too small: expected number to be >=100"],
    ["an upper-case header name", { path: "/", headers: { "X-Frame-Options": "DENY" } }, "verify.routes.0.headers.X-Frame-Options: a header name in lower case"],
    ["a body on GET", { path: "/", body: "x" }, "verify.routes.0.body: a body needs a method other than GET or HEAD"],
    ["a body on HEAD", { path: "/", method: "HEAD", body: "x" }, "verify.routes.0.body: a body needs a method other than GET or HEAD"],
    ["markers on HEAD", { path: "/", method: "HEAD", contains: ["x"] }, "verify.routes.0.method: a HEAD response has no body to hold markers"],
    ["an unknown method", { path: "/", method: "get" }, 'verify.routes.0.method: Invalid option: expected one of "GET"|"HEAD"|"POST"|"PUT"|"PATCH"|"DELETE"|"OPTIONS"'],
    ["a host request header", { path: "/", requestHeaders: { host: "other.example" } }, "verify.routes.0.requestHeaders.host: a header the request sets itself (host, content-length, connection, transfer-encoding)"],
    ["an upper-case request header", { path: "/", requestHeaders: { Accept: "text/markdown" } }, "verify.routes.0.requestHeaders.Accept: a header name in lower case"],
  ])("refuses %s", (_name, route, issue) => {
    const parsed = parseDeployConfig({ verify: { routes: [route] } });
    expect(parsed.ok ? [] : parsed.issues).toContain(issue);
  });

  it("keeps tlsMinDays and refuses one out of range or not whole", () => {
    const parsed = parseDeployConfig({ verify: { tlsMinDays: 14, routes: [{ path: "/" }] } });
    expect(parsed.ok && parsed.config.verify?.tlsMinDays).toBe(14);
    expect(parseDeployConfig({ verify: { tlsMinDays: 0, routes: [{ path: "/" }] } })).toEqual({
      ok: false,
      issues: ["verify.tlsMinDays: Too small: expected number to be >=1"],
    });
    expect(parseDeployConfig({ verify: { tlsMinDays: 366, routes: [{ path: "/" }] } })).toEqual({
      ok: false,
      issues: ["verify.tlsMinDays: Too big: expected number to be <=365"],
    });
    expect(parseDeployConfig({ verify: { tlsMinDays: 1.5, routes: [{ path: "/" }] } })).toEqual({
      ok: false,
      issues: ["verify.tlsMinDays: Invalid input: expected int, received number"],
    });
  });

  it("refuses unknown keys, an empty route list and a non-object", () => {
    expect(parseDeployConfig({ verify: { routes: [] }, extra: 1 })).toEqual({
      ok: false,
      issues: ["verify.routes: Too small: expected array to have >=1 items", '(root): Unrecognized key: "extra"'],
    });
    expect(parseDeployConfig([])).toEqual({ ok: false, issues: ["(root): Invalid input: expected object, received array"] });
  });

  it("keeps the row-count tables of the database section", () => {
    const parsed = parseDeployConfig({ database: { rowCountTables: ["users", "billing.subscriptions"] } });
    expect(parsed).toEqual({ ok: true, config: { database: { rowCountTables: ["users", "billing.subscriptions"] } } });
    expect(parseDeployConfig({ database: {} })).toEqual({ ok: true, config: { database: {} } });
  });

  it.each([
    ["an empty table list", [], "database.rowCountTables: Too small: expected array to have >=1 items"],
    ["an upper-case table name", ["Users"], "database.rowCountTables.0: a table or schema.table in lower snake case"],
    ["a three-part name", ["a.b.c"], "database.rowCountTables.0: a table or schema.table in lower snake case"],
    ["a duplicate table", ["users", "notes", "users"], "database.rowCountTables: users is listed twice"],
  ])("refuses %s", (_name, rowCountTables, issue) => {
    const parsed = parseDeployConfig({ database: { rowCountTables } });
    expect(parsed.ok ? [] : parsed.issues).toEqual([issue]);
  });

  it("refuses an unknown key in the database section", () => {
    expect(parseDeployConfig({ database: { tables: ["users"] } })).toEqual({
      ok: false,
      issues: ['database: Unrecognized key: "tables"'],
    });
  });
});

describe("parseDeployConfig: app-side checks (issue #309)", () => {
  const DIGEST = `sha256:${"a".repeat(64)}`;

  function firstRoute(route: unknown): unknown {
    const parsed = parseDeployConfig({ verify: { routes: [route] } });
    return parsed.ok ? parsed.config.verify?.routes[0] : parsed.issues;
  }

  it("keeps severity, sha256, within and count", () => {
    expect(firstRoute({ path: "/x", severity: "warn", sha256: DIGEST, within: "head", contains: ["<title"], count: { "<title": 1 } })).toEqual({
      path: "/x",
      status: 200,
      contains: ["<title"],
      excludes: [],
      headers: {},
      method: "GET",
      requestHeaders: {},
      severity: "warn",
      sha256: DIGEST,
      within: "head",
      count: { "<title": 1 },
    });
    expect(parseDeployConfig({ verify: { originSeverity: "warn", routes: [{ path: "/" }] } })).toMatchObject({
      ok: true,
      config: { verify: { originSeverity: "warn" } },
    });
  });

  it("accepts a bare hex digest and refuses one that is not 64 hex characters", () => {
    expect(firstRoute({ path: "/", sha256: "b".repeat(64) })).toMatchObject({ sha256: "b".repeat(64) });
    expect(firstRoute({ path: "/", sha256: "sha256:XYZ" })).toEqual(["verify.routes.0.sha256: sha256:<64 hex> or 64 lower-case hex characters"]);
  });

  it("fills the defaults of a sitemap loop and of an index loop", () => {
    expect(firstRoute({ forEach: { sitemap: "/sitemap.xml", match: "/blog/" } })).toMatchObject({
      forEach: { sitemap: "/sitemap.xml", match: "/blog/" },
    });
    expect(firstRoute({ forEach: { index: "/.well-known/agent-skills/index.json" } })).toMatchObject({
      forEach: { index: "/.well-known/agent-skills/index.json", items: "skills", url: "url", digest: "digest" },
    });
  });

  it("needs exactly one of path and forEach", () => {
    expect(firstRoute({})).toEqual(["verify.routes.0.path: a route needs a path or a forEach, not both"]);
    expect(firstRoute({ path: "/", forEach: { sitemap: "/sitemap.xml" } })).toEqual([
      "verify.routes.0.path: a route needs a path or a forEach, not both",
    ]);
  });

  it("refuses a negative count, a scope without anything to check and a HEAD route with body checks", () => {
    expect(firstRoute({ path: "/", count: { a: -1 } })).toEqual(["verify.routes.0.count.a: Too small: expected number to be >=0"]);
    expect(firstRoute({ path: "/", within: "head" })).toEqual(["verify.routes.0.within: within needs contains, excludes or count"]);
    expect(firstRoute({ path: "/", method: "HEAD", count: { a: 1 } })).toEqual(["verify.routes.0.method: a HEAD response has no body to hold markers"]);
    expect(firstRoute({ path: "/", method: "HEAD", sha256: DIGEST })).toEqual(["verify.routes.0.method: a HEAD response has no body to hold markers"]);
  });

  it("refuses a loop source that is not a path on the host", () => {
    expect(firstRoute({ forEach: { sitemap: "https://other.example/sitemap.xml" } })).toEqual([
      "verify.routes.0.forEach.sitemap: a path that starts with a single /",
    ]);
  });
});

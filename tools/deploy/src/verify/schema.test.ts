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
          routes: [{ path: "/", status: 200, contains: [], excludes: [], headers: {} }],
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
    expect(parsed.ok && parsed.config.verify?.routes[0]).toEqual(route);
  });

  it.each([
    ["a path without a leading slash", { path: "login" }, "verify.routes.0.path: a path that starts with a single /"],
    ["a protocol-relative path", { path: "//evil.example" }, "verify.routes.0.path: a path that starts with a single /"],
    ["a path with a space", { path: "/a b" }, "verify.routes.0.path: a path that starts with a single /"],
    ["a redirect without a 3xx status", { path: "/", redirect: "/x" }, "verify.routes.0.status: a redirect needs a 3xx status"],
    ["an empty marker", { path: "/", contains: [""] }, "verify.routes.0.contains.0: Too small: expected string to have >=1 characters"],
    ["a status out of range", { path: "/", status: 99 }, "verify.routes.0.status: Too small: expected number to be >=100"],
    ["an upper-case header name", { path: "/", headers: { "X-Frame-Options": "DENY" } }, "verify.routes.0.headers.X-Frame-Options: a header name in lower case"],
  ])("refuses %s", (_name, route, issue) => {
    const parsed = parseDeployConfig({ verify: { routes: [route] } });
    expect(parsed.ok ? [] : parsed.issues).toContain(issue);
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

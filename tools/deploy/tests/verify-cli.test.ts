import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CliIo } from "../src/cli/io.js";
import { runCli } from "../src/cli/run.js";

let dir: string;
let out: string[];
let err: string[];
let server: Server;
let baseUrl: string;

function makeIo(): CliIo {
  return { cwd: dir, env: {}, stdout: (text) => out.push(text), stderr: (text) => err.push(text) };
}

function writeConfig(config: unknown, name = "deploy.json"): void {
  mkdirSync(dirname(join(dir, name)), { recursive: true });
  writeFileSync(join(dir, name), typeof config === "string" ? config : JSON.stringify(config));
}

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "softure-deploy-verify-"));
  out = [];
  err = [];
  server = createServer((request, response) => {
    if (request.url === "/") response.writeHead(200, { "content-type": "text/html" }).end("<h1>Home</h1>");
    else if (request.url === "/old") response.writeHead(301, { location: "/new" }).end();
    else response.writeHead(404).end("Not found");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  rmSync(dir, { recursive: true, force: true });
});

describe("softure-deploy verify", () => {
  it("prints the table and exits 0 when every check passes", async () => {
    writeConfig({ verify: { routes: [{ path: "/", contains: ["<h1>Home"] }, { path: "/old", status: 301, redirect: "/new" }] } });
    expect(await runCli(["verify", `${baseUrl}/`], makeIo())).toBe(0);
    expect(out.join("")).toBe(
      [
        "Result  Status  Route  Detail",
        "PASS    200     /      2 checks passed",
        "PASS    301     /old   2 checks passed",
        "",
        `verify: 2 routes at ${baseUrl}, 2 passed, 0 failed`,
        "",
      ].join("\n"),
    );
    expect(err).toEqual([]);
  });

  it("prints the failed checks and exits 1 when a route fails", async () => {
    writeConfig(
      { verify: { routes: [{ path: "/" }, { path: "/pricing", contains: ["Pricing"] }] } },
      "config/deploy.json",
    );
    expect(await runCli(["verify", baseUrl, "--config=config/deploy.json", "--concurrency=1", "--timeout=2000"], makeIo())).toBe(1);
    expect(out.join("")).toContain('FAIL    404     /pricing  status 404, expected 200; missing "Pricing"\n');
    expect(out.join("")).toContain(`verify: 2 routes at ${baseUrl}, 1 passed, 1 failed\n`);
    expect(err.join("")).toBe("verify: 1 of 2 routes failed.\n");
  });

  it("adds a failed tls row and exits 1 when tlsMinDays is set for an http URL", async () => {
    writeConfig({ verify: { tlsMinDays: 14, routes: [{ path: "/" }] } });
    expect(await runCli(["verify", baseUrl], makeIo())).toBe(1);
    expect(out.join("")).toBe(
      [
        "Result  Status  Route  Detail",
        "PASS    200     /      1 check passed",
        "FAIL    -       tls    no certificate to check: http: is not https",
        "",
        `verify: 1 routes at ${baseUrl}, 1 passed, 0 failed; certificate failed`,
        "",
      ].join("\n"),
    );
    expect(err.join("")).toBe("verify: the TLS certificate check failed.\n");
  });

  it("names both the routes and the certificate when both fail", async () => {
    writeConfig({ verify: { tlsMinDays: 14, routes: [{ path: "/missing" }] } });
    expect(await runCli(["verify", baseUrl], makeIo())).toBe(1);
    expect(err.join("")).toBe("verify: 1 of 1 routes failed; the TLS certificate check failed.\n");
  });

  it("adds a failed origin row and exits 1 when the origin accepts a direct connection", async () => {
    writeConfig({ verify: { routes: [{ path: "/" }] } });
    // The local server stands in for an origin whose firewall lets anyone in.
    const origin = `127.0.0.1:${new URL(baseUrl).port}`;
    expect(await runCli(["verify", baseUrl, `--origin=${origin}`], makeIo())).toBe(1);
    expect(out.join("")).toBe(
      [
        "Result  Status  Route   Detail",
        "PASS    200     /       1 check passed",
        `FAIL    -       origin  ${origin} accepted a direct connection; the firewall lets more than the CDN through`,
        "",
        `verify: 1 routes at ${baseUrl}, 1 passed, 0 failed; origin failed`,
        "",
      ].join("\n"),
    );
    expect(err.join("")).toBe(`verify: the origin ${origin} is not closed to direct traffic.\n`);
  });

  it("passes the origin row and exits 0 when the origin refuses the connection", async () => {
    writeConfig({ verify: { routes: [{ path: "/" }] } });
    const closed = createServer();
    await new Promise<void>((resolve) => closed.listen(0, "127.0.0.1", resolve));
    const port = (closed.address() as AddressInfo).port;
    await new Promise<void>((resolve) => closed.close(() => resolve()));
    expect(await runCli(["verify", baseUrl, `--origin=127.0.0.1:${port}`], makeIo())).toBe(0);
    expect(out.join("")).toContain(`PASS    -       origin  127.0.0.1:${port} connection refused (nothing listens there)\n`);
    expect(out.join("")).toContain("1 passed, 0 failed; origin passed\n");
    expect(err).toEqual([]);
  });

  it("refuses a missing, malformed or invalid deploy.json and one without a verify section", async () => {
    expect(await runCli(["verify", baseUrl], makeIo())).toBe(1);
    writeConfig("{ not json");
    expect(await runCli(["verify", baseUrl], makeIo())).toBe(1);
    writeConfig({ verify: { routes: [{ path: "pricing" }] } });
    expect(await runCli(["verify", baseUrl], makeIo())).toBe(1);
    writeConfig({});
    expect(await runCli(["verify", baseUrl], makeIo())).toBe(1);
    expect(err.join("")).toBe(
      [
        "verify: cannot read deploy.json (ENOENT).",
        "verify: cannot read deploy.json (not valid JSON).",
        "verify: deploy.json is not valid:",
        "  verify.routes.0.path: a path that starts with a single /",
        'verify: deploy.json has no "verify" section; nothing to check.',
        "",
      ].join("\n"),
    );
    expect(out).toEqual([]);
  });

  it.each([
    [[]],
    [["https://a.example", "https://b.example"]],
    [["example.com"]],
    [["ftp://example.com"]],
    [["https://user:secret@example.com"]],
    [["https://example.com/?x=1"]],
    [["https://example.com", "--timeout=50"]],
    [["https://example.com", "--concurrency=0"]],
    [["https://example.com", "--concurrency=1.5"]],
    [["https://example.com", "--retries=3"]],
    [["https://example.com", "--origin=https://203.0.113.7"]],
    [["https://example.com", "--origin=203.0.113.7:0"]],
    [["https://example.com", "--origin="]],
  ])("exits 2 on a wrong command line: %j", async (args) => {
    writeConfig({ verify: { routes: [{ path: "/" }] } });
    expect(await runCli(["verify", ...args], makeIo())).toBe(2);
    expect(err.join("")).toMatch(/^verify: /);
    expect(err.join("")).not.toContain("secret");
    expect(out).toEqual([]);
  });
});

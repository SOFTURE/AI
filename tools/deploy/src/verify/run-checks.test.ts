import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { describeRequestError, runVerify } from "./run-checks.js";
import { parseDeployConfig, type VerifyConfig } from "./schema.js";

type Handler = (request: IncomingMessage, response: ServerResponse) => void;

let server: Server;
let baseUrl: string;
/** Routes of the local server; looked up by comparison, so a request path never selects a property. */
let handlers: { path: string; handle: Handler }[];
let seen: IncomingMessage[];

function verifyConfig(input: unknown): VerifyConfig {
  const parsed = parseDeployConfig({ verify: input });
  if (!parsed.ok || parsed.config.verify === undefined) throw new Error(`test config is invalid: ${JSON.stringify(parsed)}`);
  return parsed.config.verify;
}

beforeEach(async () => {
  handlers = [];
  seen = [];
  server = createServer((request, response) => {
    seen.push(request);
    const route = handlers.find(({ path }) => path === request.url);
    if (route === undefined) {
      response.writeHead(404, { "content-type": "text/plain" }).end("Not found");
      return;
    }
    route.handle(request, response);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

function serve(path: string, handle: Handler): void {
  handlers.push({ path, handle });
}

describe("runVerify against a local server", () => {
  it("passes routes whose status, markers, redirect and headers match, in config order", async () => {
    serve("/", (_request, response) =>
      response.writeHead(200, { "content-type": "text/html; charset=utf-8", "x-frame-options": "DENY" }).end("<h1>Home</h1>"));
    serve("/old", (_request, response) => response.writeHead(301, { location: "/new", "x-frame-options": "DENY" }).end());
    serve("/robots.txt", (_request, response) =>
      response.writeHead(200, { "content-type": "text/plain", "x-frame-options": "DENY" }).end("Sitemap: /sitemap.xml\n"));
    const { routes: reports } = await runVerify({
      baseUrl,
      config: verifyConfig({
        headers: { "x-frame-options": "DENY", "x-powered-by": null },
        routes: [
          { path: "/", contains: ["<h1>Home"], excludes: ["Application error"], headers: { "content-type": "text/html" } },
          { path: "/old", status: 301, redirect: "/new" },
          { path: "/robots.txt", contains: ["Sitemap:"] },
        ],
      }),
    });
    expect(reports.map((report) => [report.path, report.status, report.passed, report.checks.length])).toEqual([
      ["/", 200, true, 6],
      ["/old", 301, true, 4],
      ["/robots.txt", 200, true, 4],
    ]);
    expect(reports[1]?.checks[1]).toEqual({ kind: "redirect", passed: true, detail: `redirect to ${baseUrl}/new` });
  });

  it("does not follow a redirect and asks a CDN for a fresh response", async () => {
    serve("/old", (_request, response) => response.writeHead(302, { location: "/missing" }).end());
    const {
      routes: [report],
    } = await runVerify({ baseUrl, config: verifyConfig({ routes: [{ path: "/old", status: 302 }] }) });
    expect(report?.passed).toBe(true);
    expect(seen.map((request) => request.url)).toEqual(["/old"]);
    expect(seen[0]?.headers).toMatchObject({ "cache-control": "no-cache", "user-agent": "softure-deploy-verify" });
  });

  it("reports every failed check of a route", async () => {
    serve("/", (_request, response) =>
      response.writeHead(500, { "x-powered-by": "Next.js" }).end("Application error: a server-side exception"));
    const {
      routes: [report],
    } = await runVerify({
      baseUrl,
      config: verifyConfig({
        headers: { "x-powered-by": null },
        routes: [{ path: "/", contains: ["<h1>Home"], excludes: ["Application error"] }],
      }),
    });
    expect(report).toEqual({
      path: "/",
      url: `${baseUrl}/`,
      status: 500,
      passed: false,
      checks: [
        { kind: "status", passed: false, detail: "status 500, expected 200" },
        { kind: "contains", passed: false, detail: 'missing "<h1>Home"' },
        { kind: "excludes", passed: false, detail: 'unexpected "Application error"' },
        { kind: "header", passed: false, detail: 'unexpected x-powered-by: "Next.js"' },
      ],
    });
  });

  it("turns a timeout into a failed request check of that route only", async () => {
    serve("/slow", () => undefined);
    serve("/fast", (_request, response) => response.writeHead(200).end());
    const { routes: reports } = await runVerify({
      baseUrl,
      timeoutMs: 150,
      config: verifyConfig({ routes: [{ path: "/slow" }, { path: "/fast" }] }),
    });
    expect(reports.map((report) => [report.path, report.status, report.checks])).toEqual([
      ["/slow", null, [{ kind: "request", passed: false, detail: "no response within 150 ms" }]],
      ["/fast", 200, [{ kind: "status", passed: true, detail: "status 200" }]],
    ]);
  });

  it("names the connection error when nothing listens", async () => {
    const closedUrl = baseUrl;
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    server = createServer();
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const {
      routes: [report],
    } = await runVerify({ baseUrl: closedUrl, config: verifyConfig({ routes: [{ path: "/" }] }) });
    expect(report?.checks).toEqual([{ kind: "request", passed: false, detail: "request failed: ECONNREFUSED" }]);
  });

  it("keeps config order while running at most the given number of requests at once", async () => {
    let active = 0;
    let peak = 0;
    for (const [index, path] of ["/a", "/b", "/c", "/d", "/e"].entries()) {
      serve(path, (_request, response) => {
        active += 1;
        peak = Math.max(peak, active);
        setTimeout(() => {
          active -= 1;
          response.writeHead(200).end();
        }, 40 - index * 8);
      });
    }
    const { routes: reports } = await runVerify({
      baseUrl,
      concurrency: 2,
      config: verifyConfig({ routes: ["/a", "/b", "/c", "/d", "/e"].map((path) => ({ path })) }),
    });
    expect(reports.map((report) => report.path)).toEqual(["/a", "/b", "/c", "/d", "/e"]);
    expect(peak).toBe(2);
  });
});

describe("runVerify with tlsMinDays", () => {
  it("reads no certificate without the key", async () => {
    serve("/", (_request, response) => response.writeHead(200).end());
    const report = await runVerify({ baseUrl, config: verifyConfig({ routes: [{ path: "/" }] }) });
    expect(report.tls).toBeNull();
  });

  it("fails the tls row of an http URL and still checks the routes", async () => {
    serve("/", (_request, response) => response.writeHead(200).end());
    const report = await runVerify({ baseUrl, config: verifyConfig({ tlsMinDays: 14, routes: [{ path: "/" }] }) });
    expect(report.routes.map((route) => route.passed)).toEqual([true]);
    expect(report.tls).toEqual({ passed: false, daysLeft: null, detail: "no certificate to check: http: is not https" });
  });
});

describe("describeRequestError", () => {
  it("falls back to the cause message and then to the error message", () => {
    expect(describeRequestError(new Error("fetch failed", { cause: new Error("certificate has expired") }), 1)).toBe(
      "request failed: certificate has expired",
    );
    expect(describeRequestError(new TypeError("Invalid URL"), 1)).toBe("request failed: Invalid URL");
    expect(describeRequestError("boom", 1)).toBe("request failed: boom");
  });
});

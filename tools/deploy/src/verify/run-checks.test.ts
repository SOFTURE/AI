import { createHash } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { verify } from "web-bot-auth";
import { verifierFromJWK } from "web-bot-auth/crypto";
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
  it("sends a route's method, body and request headers on top of verify's own", async () => {
    const received: { method?: string; body: string; headers: IncomingMessage["headers"] }[] = [];
    serve("/api/mcp", (request, response) => {
      let body = "";
      request.setEncoding("utf8");
      request.on("data", (chunk: string) => (body += chunk));
      request.on("end", () => {
        received.push({ method: request.method, body, headers: request.headers });
        response.writeHead(401, { "www-authenticate": 'Bearer resource_metadata="https://app.example/.well-known/x"' }).end();
      });
    });
    serve("/", (request, response) =>
      response.writeHead(200, { "content-type": request.headers.accept === "text/markdown" ? "text/markdown" : "text/html" }).end("# Home"));
    const { routes } = await runVerify({
      baseUrl,
      config: verifyConfig({
        routes: [
          {
            path: "/api/mcp",
            method: "POST",
            status: 401,
            body: '{"jsonrpc":"2.0","id":1,"method":"tools/list"}',
            requestHeaders: { "content-type": "application/json" },
            headers: { "www-authenticate": "resource_metadata=" },
          },
          { path: "/", requestHeaders: { accept: "text/markdown", "user-agent": "GPTBot/1.3" }, headers: { "content-type": "text/markdown" } },
        ],
      }),
    });
    expect(routes.map((route) => [route.method, route.path, route.passed])).toEqual([
      ["POST", "/api/mcp", true],
      ["GET", "/", true],
    ]);
    expect(received).toHaveLength(1);
    expect(received[0]?.method).toBe("POST");
    expect(received[0]?.body).toBe('{"jsonrpc":"2.0","id":1,"method":"tools/list"}');
    expect(received[0]?.headers["content-type"]).toBe("application/json");
    expect(received[0]?.headers["user-agent"]).toBe("softure-deploy-verify");
    const home = seen.find((request) => request.url === "/");
    expect(home?.headers["user-agent"]).toBe("GPTBot/1.3");
    expect(home?.headers["cache-control"]).toBe("no-cache");
  });

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
      method: "GET",
      path: "/",
      url: `${baseUrl}/`,
      status: 500,
      passed: false,
      severity: "fail",
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

describe("runVerify with an origin", () => {
  it("tries no direct connection without one", async () => {
    serve("/", (_request, response) => response.writeHead(200).end());
    const report = await runVerify({ baseUrl, config: verifyConfig({ routes: [{ path: "/" }] }) });
    expect(report.origin).toBeNull();
  });

  it("fails the origin row when the origin accepts a direct connection and still checks the routes", async () => {
    serve("/", (_request, response) => response.writeHead(200).end());
    // The local server stands in for an origin whose firewall lets anyone in.
    const port = Number(new URL(baseUrl).port);
    const report = await runVerify({
      baseUrl,
      config: verifyConfig({ routes: [{ path: "/" }] }),
      origin: { host: "127.0.0.1", port },
    });
    expect(report.routes.map((route) => route.passed)).toEqual([true]);
    expect(report.origin).toEqual({
      address: `127.0.0.1:${port}`,
      passed: false,
      severity: "fail",
      detail: `127.0.0.1:${port} accepted a direct connection; the firewall lets more than the CDN through`,
    });
  });
});

describe("runVerify: app-side checks (issue #309)", () => {
  const SKILL = "---\nname: search\n---\nUse the search tool.\n";
  const SKILL_DIGEST = `sha256:${createHash("sha256").update(SKILL, "utf8").digest("hex")}`;

  it("checks every sitemap entry whose path matches, on the verified origin, with the route's user agent", async () => {
    serve("/sitemap.xml", (_request, response) =>
      response.writeHead(200, { "content-type": "application/xml" }).end(
        [
          '<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
          "<url><loc>https://prod.example/</loc></url>",
          "<url><loc>https://prod.example/blog/first?x=1&amp;y=2</loc></url>",
          "<url><loc>\n  https://prod.example/blog/second\n</loc></url>",
          "</urlset>",
        ].join(""),
      ));
    serve("/blog/first?x=1&y=2", (_request, response) => response.writeHead(200).end("<head><title>First</title></head>"));
    serve("/blog/second", (_request, response) => response.writeHead(404).end("Not found"));
    const { routes } = await runVerify({
      baseUrl,
      config: verifyConfig({
        routes: [
          {
            forEach: { sitemap: "/sitemap.xml", match: "/blog/" },
            requestHeaders: { "user-agent": "GPTBot/1.3" },
            within: "head",
            contains: ["<title>"],
          },
        ],
      }),
    });
    expect(routes.map((route) => [route.path, route.url, route.status, route.passed])).toEqual([
      ["/blog/first?x=1&y=2", `${baseUrl}/blog/first?x=1&y=2`, 200, true],
      ["/blog/second", `${baseUrl}/blog/second`, 404, false],
    ]);
    expect(seen.map((request) => [request.url, request.headers["user-agent"]])).toEqual([
      ["/sitemap.xml", "GPTBot/1.3"],
      ["/blog/first?x=1&y=2", "GPTBot/1.3"],
      ["/blog/second", "GPTBot/1.3"],
    ]);
  });

  it("fails one row naming the sitemap when it is missing or nothing matches", async () => {
    serve("/sitemap.xml", (_request, response) => response.writeHead(200).end("<urlset><url><loc>https://prod.example/</loc></url></urlset>"));
    const { routes } = await runVerify({
      baseUrl,
      config: verifyConfig({ routes: [{ forEach: { sitemap: "/missing.xml" } }, { forEach: { sitemap: "/sitemap.xml", match: "/blog/" } }] }),
    });
    expect(routes).toEqual([
      {
        method: "GET",
        path: "sitemap /missing.xml",
        url: `${baseUrl}/missing.xml`,
        status: 404,
        passed: false,
        severity: "fail",
        checks: [{ kind: "source", passed: false, detail: "sitemap /missing.xml: status 404, expected 200" }],
      },
      {
        method: "GET",
        path: "sitemap /sitemap.xml",
        url: `${baseUrl}/sitemap.xml`,
        status: 200,
        passed: false,
        severity: "fail",
        checks: [{ kind: "source", passed: false, detail: 'sitemap /sitemap.xml: no entry matches "/blog/"' }],
      },
    ]);
  });

  it("checks every entry of an Agent Skills index against its digest", async () => {
    const index = {
      skills: [
        { name: "search", url: "/.well-known/agent-skills/search/SKILL.md", digest: SKILL_DIGEST },
        { name: "stale", url: "https://prod.example/.well-known/agent-skills/stale/SKILL.md", digest: SKILL_DIGEST },
      ],
    };
    serve("/.well-known/agent-skills/index.json", (_request, response) => response.writeHead(200).end(JSON.stringify(index)));
    serve("/.well-known/agent-skills/search/SKILL.md", (_request, response) => response.writeHead(200).end(SKILL));
    serve("/.well-known/agent-skills/stale/SKILL.md", (_request, response) => response.writeHead(200).end(`${SKILL}edited\n`));
    const { routes } = await runVerify({
      baseUrl,
      config: verifyConfig({ routes: [{ forEach: { index: "/.well-known/agent-skills/index.json" }, contains: ["name: search"] }] }),
    });
    expect(routes.map((route) => [route.path, route.passed, route.checks.map((check) => check.kind)])).toEqual([
      ["/.well-known/agent-skills/search/SKILL.md", true, ["status", "contains", "sha256"]],
      ["/.well-known/agent-skills/stale/SKILL.md", false, ["status", "contains", "sha256"]],
    ]);
    expect(routes[1]?.checks[2]?.detail).toMatch(/^sha256 [0-9a-f]{64}, expected [0-9a-f]{64}$/);
  });

  it("fails one row naming the index when it is not the expected JSON", async () => {
    serve("/a.json", (_request, response) => response.writeHead(200).end("not json"));
    serve("/b.json", (_request, response) => response.writeHead(200).end(JSON.stringify({ skills: [{ url: 1 }] })));
    serve("/c.json", (_request, response) => response.writeHead(200).end(JSON.stringify({ skills: [{ url: "/x", digest: "md5:1" }] })));
    const { routes } = await runVerify({
      baseUrl,
      config: verifyConfig({ routes: ["/a.json", "/b.json", "/c.json"].map((index) => ({ forEach: { index } })) }),
    });
    expect(routes.map((route) => route.checks[0]?.detail)).toEqual([
      "index /a.json: not JSON",
      "index /b.json: entry 0 has no url text",
      'index /c.json: entry 0 digest "md5:1" is not sha256:<hex>',
    ]);
  });

  it("keeps a warn route's severity on its rows", async () => {
    serve("/", (_request, response) => response.writeHead(404).end());
    const { routes } = await runVerify({ baseUrl, config: verifyConfig({ routes: [{ path: "/", severity: "warn" }] }) });
    expect(routes.map((route) => [route.passed, route.severity])).toEqual([[false, "warn"]]);
  });

  it("reads the body as bytes, so the digest covers exactly what was served", async () => {
    const bytes = Buffer.from([0xef, 0xbb, 0xbf, 0x68, 0x69]);
    serve("/bom.txt", (_request, response) => response.writeHead(200).end(bytes));
    const digest = createHash("sha256").update(bytes).digest("hex");
    const { routes } = await runVerify({ baseUrl, config: verifyConfig({ routes: [{ path: "/bom.txt", sha256: digest }] }) });
    expect(routes[0]?.passed).toBe(true);
  });
});

describe("runVerify: a request signed with Web Bot Auth (issue #341)", () => {
  /** The test key of RFC 9421 Appendix B.1.4: a public vector, not a secret. */
  const RFC_SEED = "n4Ni-HpISpVObnQMW0wOhCKROaIKqKtW_2ZYb2p9KcU";
  const RFC_X = "JrQLj5P_89iXES9-vFgrIy29clF9CC_oPPsw3c5D0bs";

  /** Verifies what the server received with the reference library, as a receiver would. */
  async function verifyReceived(request: IncomingMessage): Promise<{ tag: string; agent: string | undefined }> {
    const headers = new Headers();
    for (const [name, value] of Object.entries(request.headers)) if (typeof value === "string") headers.set(name, value);
    const verifier = await verifierFromJWK({ kty: "OKP", crv: "Ed25519", x: RFC_X });
    const result = await verify(new Request(`${baseUrl}${request.url ?? "/"}`, { headers }), { resolver: () => verifier });
    return { tag: result.tag, agent: result.signatureAgent?.uri };
  }

  it("signs every request of the route, a forEach source and its entries included, as the verified origin", async () => {
    serve("/sitemap.xml", (_request, response) =>
      response.writeHead(200).end("<urlset><url><loc>https://prod.example/a</loc></url><url><loc>https://prod.example/b</loc></url></urlset>"));
    for (const path of ["/", "/a", "/b"]) {
      serve(path, (request, response) => response.writeHead(request.headers.signature === undefined ? 403 : 200).end("ok"));
    }
    const { routes } = await runVerify({
      baseUrl,
      env: { WEB_BOT_AUTH_PRIVATE_KEY: RFC_SEED },
      config: verifyConfig({ routes: [{ path: "/", webBotAuth: {} }, { forEach: { sitemap: "/sitemap.xml" }, webBotAuth: {} }] }),
    });
    expect(routes.map((route) => [route.path, route.passed])).toEqual([["/", true], ["/a", true], ["/b", true]]);
    expect(seen.map((request) => request.url).sort()).toEqual(["/", "/a", "/b", "/sitemap.xml"]);
    for (const request of seen) {
      expect(await verifyReceived(request)).toEqual({ tag: "web-bot-auth", agent: baseUrl });
    }
  });

  it("names the configured agent and leaves routes without webBotAuth unsigned", async () => {
    serve("/signed", (_request, response) => response.writeHead(200).end());
    serve("/plain", (_request, response) => response.writeHead(200).end());
    await runVerify({
      baseUrl,
      env: { BOT_SEED: RFC_SEED },
      config: verifyConfig({ routes: [{ path: "/signed", webBotAuth: { keyEnv: "BOT_SEED", agent: "https://example.com" } }, { path: "/plain" }] }),
    });
    const signed = seen.find((request) => request.url === "/signed");
    const plain = seen.find((request) => request.url === "/plain");
    expect(signed && (await verifyReceived(signed))).toEqual({ tag: "web-bot-auth", agent: "https://example.com" });
    expect(plain?.headers.signature).toBeUndefined();
  });

  it("fails the route naming a missing or malformed variable, sends nothing and never prints the value", async () => {
    serve("/", (_request, response) => response.writeHead(200).end());
    const { routes } = await runVerify({
      baseUrl,
      env: { BAD_SEED: "secret-but-malformed" },
      config: verifyConfig({
        routes: [
          { path: "/", webBotAuth: {} },
          { path: "/", webBotAuth: { keyEnv: "BAD_SEED" } },
          { forEach: { sitemap: "/sitemap.xml" }, webBotAuth: {} },
        ],
      }),
    });
    expect(routes.map((route) => [route.path, route.status, route.checks])).toEqual([
      ["/", null, [{ kind: "request", passed: false, detail: "WEB_BOT_AUTH_PRIVATE_KEY is not set" }]],
      ["/", null, [{ kind: "request", passed: false, detail: "BAD_SEED is not a base64url Ed25519 seed (32 bytes)" }]],
      ["sitemap /sitemap.xml", null, [{ kind: "source", passed: false, detail: "sitemap /sitemap.xml: WEB_BOT_AUTH_PRIVATE_KEY is not set" }]],
    ]);
    expect(seen).toEqual([]);
    expect(JSON.stringify(routes)).not.toContain("secret-but-malformed");
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

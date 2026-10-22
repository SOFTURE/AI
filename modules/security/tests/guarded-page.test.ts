// The guarded page fetch against a fake server on loopback: the body and its metadata, redirects checked hop by
// hop, the byte cap after decompression and the one time limit.
import { once } from "node:events";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { brotliCompressSync, deflateSync, gzipSync } from "node:zlib";
import { fetchGuardedPage, type GuardedRequestSeam, type ResolveHost } from "@softure-ai/security/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

let server: Server;
let port: number;
let received: IncomingMessage[];
let routes: Map<string, (response: ServerResponse) => void>;

beforeEach(async () => {
  received = [];
  routes = new Map();
  server = createServer((request, response) => {
    received.push(request);
    // Matched by comparing paths, never by looking a handler up with the request's URL as the key.
    const route = [...routes].find(([path]) => path === request.url)?.[1];
    if (route === undefined) {
      response.writeHead(404, { "content-type": "text/plain" }).end("missing");
    } else {
      route(response);
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  port = (server.address() as AddressInfo).port;
});

afterEach(async () => {
  server.closeAllConnections();
  server.close();
  await once(server, "close");
});

const resolvedHosts: string[] = [];
const resolveToLoopback: ResolveHost = (hostname, _family, callback) => {
  resolvedHosts.push(hostname);
  callback(null, [{ address: "127.0.0.1", family: 4 }]);
};
const loopbackAllowed: GuardedRequestSeam = { isAllowedAddress: (address) => address === "127.0.0.1", resolveHost: resolveToLoopback };

function page(path: string): string {
  return `http://links.test:${port}${path}`;
}

function html(body: string, headers: Record<string, string> = { "content-type": "text/html; charset=utf-8" }): (response: ServerResponse) => void {
  return (response) => response.writeHead(200, headers).end(body);
}

function redirect(status: number, location: string): (response: ServerResponse) => void {
  return (response) => response.writeHead(status, { location }).end();
}

const text = (body: Uint8Array): string => new TextDecoder().decode(body);

describe("fetchGuardedPage", () => {
  beforeEach(() => {
    resolvedHosts.length = 0;
  });

  it("returns the body with its status, content type and charset", async () => {
    routes.set("/article", html("<h1>Hello</h1>", { "content-type": "Text/HTML; Charset=\"UTF-8\"" }));
    const result = await fetchGuardedPage(page("/article"), { timeoutMs: 2000, maxBytes: 1000, allowedPorts: [port] }, loopbackAllowed);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect({ ...result.value, body: text(result.value.body) }).toEqual({
      status: 200,
      finalUrl: page("/article"),
      contentType: "text/html",
      charset: "utf-8",
      body: "<h1>Hello</h1>",
      truncated: false,
    });
    expect(result.value.body).toBeInstanceOf(Uint8Array);
  });

  it("sends GET with the accept, user-agent and accept-encoding headers", async () => {
    routes.set("/", html("ok"));
    await fetchGuardedPage(page("/"), { timeoutMs: 2000, maxBytes: 100, allowedPorts: [port], accept: "text/html", userAgent: "LinkBot/1.0" }, loopbackAllowed);
    expect(received).toHaveLength(1);
    expect(received[0]?.method).toBe("GET");
    expect(received[0]?.headers.accept).toBe("text/html");
    expect(received[0]?.headers["user-agent"]).toBe("LinkBot/1.0");
    expect(received[0]?.headers["accept-encoding"]).toBe("gzip, deflate, br");
  });

  it("sends a default accept and user-agent", async () => {
    routes.set("/", html("ok"));
    await fetchGuardedPage(page("/"), { timeoutMs: 2000, maxBytes: 100, allowedPorts: [port] }, loopbackAllowed);
    expect(received[0]?.headers.accept).toBe("text/html,application/xhtml+xml;q=0.9,*/*;q=0.8");
    expect(received[0]?.headers["user-agent"]).toBe("Mozilla/5.0 (compatible; softure-ai-security)");
  });

  it("returns a page that is not 2xx with its body", async () => {
    const result = await fetchGuardedPage(page("/gone"), { timeoutMs: 2000, maxBytes: 100, allowedPorts: [port] }, loopbackAllowed);
    expect(result.ok && { status: result.value.status, body: text(result.value.body) }).toEqual({ status: 404, body: "missing" });
  });

  it("follows a chain of redirects, relative and absolute, resolving every hop through the guard", async () => {
    routes.set("/short", redirect(301, "/step"));
    routes.set("/step", redirect(302, `http://final.test:${port}/article?id=1`));
    routes.set("/article?id=1", html("final"));
    const result = await fetchGuardedPage(page("/short"), { timeoutMs: 2000, maxBytes: 100, allowedPorts: [port] }, loopbackAllowed);
    expect(result.ok && { finalUrl: result.value.finalUrl, body: text(result.value.body) }).toEqual({
      finalUrl: `http://final.test:${port}/article?id=1`,
      body: "final",
    });
    expect(received.map((request) => request.url)).toEqual(["/short", "/step", "/article?id=1"]);
    expect(resolvedHosts).toEqual(["links.test", "links.test", "final.test"]);
  });

  it.each([303, 307, 308])("follows a %s redirect", async (status) => {
    routes.set("/from", redirect(status, "/to"));
    routes.set("/to", html("there"));
    const result = await fetchGuardedPage(page("/from"), { timeoutMs: 2000, maxBytes: 100, allowedPorts: [port] }, loopbackAllowed);
    expect(result.ok && result.value.finalUrl).toBe(page("/to"));
  });

  it("refuses a redirect to a non-public literal before connecting to it", async () => {
    routes.set("/", redirect(302, "http://169.254.169.254/latest/meta-data"));
    const result = await fetchGuardedPage(page("/"), { timeoutMs: 2000, maxBytes: 100, allowedPorts: [port, 80] }, loopbackAllowed);
    expect(result).toEqual({ ok: false, error: "security.outbound_blocked" });
  });

  it("refuses a redirect to a host that resolves to a non-public address", async () => {
    routes.set("/", redirect(302, `http://internal.test:${port}/admin`));
    const result = await fetchGuardedPage(
      page("/"),
      { timeoutMs: 2000, maxBytes: 100, allowedPorts: [port] },
      {
        isAllowedAddress: (address) => address === "127.0.0.1",
        resolveHost: (hostname, _family, callback) => {
          callback(null, [{ address: hostname === "internal.test" ? "10.0.0.5" : "127.0.0.1", family: 4 }]);
        },
      },
    );
    expect(result).toEqual({ ok: false, error: "security.outbound_blocked" });
    expect(received.map((request) => request.url)).toEqual(["/"]);
  });

  it("refuses a redirect to a port outside allowedPorts", async () => {
    routes.set("/", redirect(302, "http://links.test:6379/"));
    const result = await fetchGuardedPage(page("/"), { timeoutMs: 2000, maxBytes: 100, allowedPorts: [port] }, loopbackAllowed);
    expect(result).toEqual({ ok: false, error: "security.outbound_blocked" });
  });

  it.each(["file:///etc/passwd", "ftp://links.test/", "http://user:secret@links.test/", "http://[::1"])(
    "refuses a redirect to %s as an invalid URL",
    async (location) => {
      routes.set("/", redirect(302, location));
      const result = await fetchGuardedPage(page("/"), { timeoutMs: 2000, maxBytes: 100, allowedPorts: [port] }, loopbackAllowed);
      expect(result).toEqual({ ok: false, error: "security.outbound_invalid_url" });
    },
  );

  it("fails after more redirects than maxRedirects", async () => {
    routes.set("/loop", redirect(302, "/loop"));
    const result = await fetchGuardedPage(page("/loop"), { timeoutMs: 2000, maxBytes: 100, maxRedirects: 3, allowedPorts: [port] }, loopbackAllowed);
    expect(result).toEqual({ ok: false, error: "security.outbound_failed" });
    expect(received).toHaveLength(4);
  });

  it("follows exactly maxRedirects hops", async () => {
    routes.set("/a", redirect(302, "/b"));
    routes.set("/b", html("b"));
    const result = await fetchGuardedPage(page("/a"), { timeoutMs: 2000, maxBytes: 100, maxRedirects: 1, allowedPorts: [port] }, loopbackAllowed);
    expect(result.ok && result.value.finalUrl).toBe(page("/b"));
  });

  it("returns a redirect as the page with maxRedirects 0", async () => {
    routes.set("/a", redirect(302, "/b"));
    const result = await fetchGuardedPage(page("/a"), { timeoutMs: 2000, maxBytes: 100, maxRedirects: 0, allowedPorts: [port] }, loopbackAllowed);
    expect(result.ok && { status: result.value.status, finalUrl: result.value.finalUrl }).toEqual({ status: 302, finalUrl: page("/a") });
    expect(received).toHaveLength(1);
  });

  it("returns a 3xx without a location as the page", async () => {
    routes.set("/", (response) => response.writeHead(304).end());
    const result = await fetchGuardedPage(page("/"), { timeoutMs: 2000, maxBytes: 100, allowedPorts: [port] }, loopbackAllowed);
    expect(result.ok && result.value.status).toBe(304);
  });

  it("cuts a body longer than maxBytes and says so", async () => {
    routes.set("/", (response) => {
      response.writeHead(200, { "content-type": "text/plain" });
      response.write("a".repeat(600));
      response.end("b".repeat(600));
    });
    const result = await fetchGuardedPage(page("/"), { timeoutMs: 2000, maxBytes: 1000, allowedPorts: [port] }, loopbackAllowed);
    expect(result.ok && { length: result.value.body.length, truncated: result.value.truncated, tail: text(result.value.body).slice(-401) }).toEqual({
      length: 1000,
      truncated: true,
      tail: `a${"b".repeat(400)}`,
    });
  });

  it("keeps a body of exactly maxBytes whole", async () => {
    routes.set("/", html("x".repeat(100)));
    const result = await fetchGuardedPage(page("/"), { timeoutMs: 2000, maxBytes: 100, allowedPorts: [port] }, loopbackAllowed);
    expect(result.ok && { length: result.value.body.length, truncated: result.value.truncated }).toEqual({ length: 100, truncated: false });
  });

  it("refuses a body longer than maxBytes with allowTruncation false", async () => {
    routes.set("/", html("x".repeat(101)));
    const result = await fetchGuardedPage(page("/"), { timeoutMs: 2000, maxBytes: 100, allowedPorts: [port], allowTruncation: false }, loopbackAllowed);
    expect(result).toEqual({ ok: false, error: "security.outbound_too_large" });
  });

  it("stops reading a body that never ends at maxBytes", async () => {
    routes.set("/", (response) => {
      response.writeHead(200, { "content-type": "text/plain" });
      const timer = setInterval(() => response.write("y".repeat(512)), 1);
      response.on("close", () => clearInterval(timer));
    });
    const result = await fetchGuardedPage(page("/"), { timeoutMs: 2000, maxBytes: 4096, allowedPorts: [port] }, loopbackAllowed);
    expect(result.ok && { length: result.value.body.length, truncated: result.value.truncated }).toEqual({ length: 4096, truncated: true });
  });

  it.each([
    ["gzip", gzipSync],
    ["deflate", deflateSync],
    ["br", brotliCompressSync],
  ] as const)("decodes a %s body", async (encoding, compress) => {
    routes.set("/", (response) => response.writeHead(200, { "content-type": "text/html", "content-encoding": encoding }).end(compress("<p>Hello</p>")));
    const result = await fetchGuardedPage(page("/"), { timeoutMs: 2000, maxBytes: 100, allowedPorts: [port] }, loopbackAllowed);
    expect(result.ok && text(result.value.body)).toBe("<p>Hello</p>");
  });

  it("caps a compressed body by its decoded size", async () => {
    const bomb = gzipSync(Buffer.alloc(10 * 1024 * 1024));
    routes.set("/", (response) => response.writeHead(200, { "content-type": "text/plain", "content-encoding": "gzip" }).end(bomb));
    const result = await fetchGuardedPage(page("/"), { timeoutMs: 2000, maxBytes: 64 * 1024, allowedPorts: [port] }, loopbackAllowed);
    expect(bomb.length).toBeLessThan(64 * 1024);
    expect(result.ok && { length: result.value.body.length, truncated: result.value.truncated }).toEqual({ length: 64 * 1024, truncated: true });
  });

  it("fails on a body that does not decode", async () => {
    routes.set("/", (response) => response.writeHead(200, { "content-encoding": "gzip" }).end("not gzip"));
    const result = await fetchGuardedPage(page("/"), { timeoutMs: 2000, maxBytes: 100, allowedPorts: [port] }, loopbackAllowed);
    expect(result).toEqual({ ok: false, error: "security.outbound_failed" });
  });

  it("fails on an encoding it cannot undo", async () => {
    routes.set("/", (response) => response.writeHead(200, { "content-encoding": "zstd" }).end("data"));
    const result = await fetchGuardedPage(page("/"), { timeoutMs: 2000, maxBytes: 100, allowedPorts: [port] }, loopbackAllowed);
    expect(result).toEqual({ ok: false, error: "security.outbound_failed" });
  });

  it.each([
    ['<meta charset="windows-1250">', "windows-1250"],
    ["<meta charset=ISO-8859-2>", "iso-8859-2"],
    ['<meta http-equiv="Content-Type" content="text/html; charset=Shift_JIS">', "shift_jis"],
  ])("reads the charset of an HTML page from %s when the header has none", async (meta, charset) => {
    routes.set("/", html(`<html><head>${meta}<title>t</title></head></html>`, { "content-type": "text/html" }));
    const result = await fetchGuardedPage(page("/"), { timeoutMs: 2000, maxBytes: 1000, allowedPorts: [port] }, loopbackAllowed);
    expect(result.ok && result.value.charset).toBe(charset);
  });

  it("prefers the header's charset and reads no meta outside HTML", async () => {
    routes.set("/html", html('<meta charset="windows-1250">', { "content-type": "text/html; charset=utf-8" }));
    routes.set("/text", html('<meta charset="windows-1250">', { "content-type": "text/plain" }));
    routes.set("/none", (response) => response.writeHead(200).end("bytes"));
    const options = { timeoutMs: 2000, maxBytes: 1000, allowedPorts: [port] };
    const [fromHeader, plain, none] = await Promise.all([
      fetchGuardedPage(page("/html"), options, loopbackAllowed),
      fetchGuardedPage(page("/text"), options, loopbackAllowed),
      fetchGuardedPage(page("/none"), options, loopbackAllowed),
    ]);
    expect(fromHeader.ok && fromHeader.value.charset).toBe("utf-8");
    expect(plain.ok && { contentType: plain.value.contentType, charset: plain.value.charset }).toEqual({ contentType: "text/plain", charset: null });
    expect(none.ok && { contentType: none.value.contentType, charset: none.value.charset }).toEqual({ contentType: null, charset: null });
  });

  it("times out on a body that trickles past timeoutMs", async () => {
    routes.set("/", (response) => {
      response.writeHead(200, { "content-type": "text/plain" });
      const timer = setInterval(() => response.write("z"), 20);
      response.on("close", () => clearInterval(timer));
    });
    const result = await fetchGuardedPage(page("/"), { timeoutMs: 150, maxBytes: 1_000_000, allowedPorts: [port] }, loopbackAllowed);
    expect(result).toEqual({ ok: false, error: "security.outbound_timeout" });
  });

  it("times out across redirects with one limit for the whole fetch", async () => {
    const slowRedirect = (location: string) => (response: ServerResponse) => {
      setTimeout(() => response.writeHead(302, { location }).end(), 80);
    };
    routes.set("/1", slowRedirect("/2"));
    routes.set("/2", slowRedirect("/3"));
    routes.set("/3", slowRedirect("/4"));
    routes.set("/4", html("late"));
    const result = await fetchGuardedPage(page("/1"), { timeoutMs: 200, maxBytes: 100, allowedPorts: [port] }, loopbackAllowed);
    expect(result).toEqual({ ok: false, error: "security.outbound_timeout" });
  });

  it("refuses the first URL with the same checks as sendGuardedRequest", async () => {
    const options = { timeoutMs: 2000, maxBytes: 100 };
    expect(await fetchGuardedPage("not a url", options)).toEqual({ ok: false, error: "security.outbound_invalid_url" });
    expect(await fetchGuardedPage("http://127.0.0.1/", options)).toEqual({ ok: false, error: "security.outbound_blocked" });
    expect(await fetchGuardedPage("https://example.com:8443/", options)).toEqual({ ok: false, error: "security.outbound_blocked" });
    expect(await fetchGuardedPage(`http://localhost:${port}/`, { ...options, allowedPorts: [port] })).toEqual({ ok: false, error: "security.outbound_blocked" });
    expect(received).toHaveLength(0);
  });

  it("reports a resolver failure as a failed fetch", async () => {
    const failing: ResolveHost = (_hostname, _family, callback) => callback(new Error("ENOTFOUND"), []);
    expect(await fetchGuardedPage("https://missing.test/", { timeoutMs: 2000, maxBytes: 100 }, { resolveHost: failing })).toEqual({
      ok: false,
      error: "security.outbound_failed",
    });
  });

  it.each([
    [{ timeoutMs: 0, maxBytes: 100 }],
    [{ timeoutMs: 1000, maxBytes: 0 }],
    [{ timeoutMs: 1000, maxBytes: 1.5 }],
    [{ timeoutMs: 1000, maxBytes: 100, maxRedirects: -1 }],
    [{ timeoutMs: 1000, maxBytes: 100, allowedPorts: [] }],
  ])("throws on the options %j", async (options) => {
    await expect(fetchGuardedPage("https://example.com/", options)).rejects.toThrow(RangeError);
  });
});
